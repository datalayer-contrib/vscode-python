// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CellMatcher } from '../../../../client/datascience/cellMatcher';
import { concatMultilineStringInput } from '../../../../client/datascience/common';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState } from '../../../../client/datascience/types';
import { CursorPos, IMainState } from '../../../interactive-common/mainState';
import { createPostableAction } from '../../../interactive-common/redux/postOffice';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { ICellAction, ICodeAction } from '../../../interactive-common/redux/reducers/types';
import { QueueAnotherFunc } from '../../../react-common/reduxUtils';
import { IChangeCellTypeAction, NativeEditorActionTypes } from '../actions';
import { NativeEditorReducerArg } from '../mapping';
import { Effects } from './effects';

export namespace Execution {

    function executeRange(prevState: IMainState, start: number, end: number, codes: string[], queueAction: QueueAnotherFunc<NativeEditorActionTypes>): IMainState {
        const newVMs = [...prevState.cellVMs];
        for (let pos = start; pos <= end; pos += 1) {
            const orig = prevState.cellVMs[pos];
            const code = codes[pos - start];
            // noop if the submitted code is just a cell marker
            const matcher = new CellMatcher(prevState.settings);
            if (code && matcher.stripFirstMarker(code).length > 0) {
                if (orig.cell.data.cell_type === 'code') {
                    // Update our input cell to be in progress again and clear outputs
                    newVMs[pos] = { ...orig, inputBlockText: code, cell: { ...orig.cell, state: CellState.executing, data: { ...orig.cell.data, source: code, outputs: [] } } };
                } else {
                    // Update our input to be our new code
                    newVMs[pos] = { ...orig, inputBlockText: code, cell: { ...orig.cell, data: { ...orig.cell.data, source: code } } };
                }
            }

            // Send a message for each
            queueAction(createPostableAction(InteractiveWindowMessages.ReExecuteCell, { code, id: orig.cell.id }));
        }

        return {
            ...prevState,
            cellVMs: newVMs
        };
    }

    export function executeAbove(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index > 0) {
            const codes = arg.prevState.cellVMs.filter((_c, i) => i < index).map(c => concatMultilineStringInput(c.cell.data.source));
            return executeRange(arg.prevState, 0, index - 1, codes, arg.queueAction);
        }
        return arg.prevState;
    }

    export function executeCell(arg: NativeEditorReducerArg<ICodeAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index >= 0) {
            return executeRange(arg.prevState, index, index, [arg.payload.code], arg.queueAction);
        }
        return arg.prevState;
    }

    export function executeCellAndBelow(arg: NativeEditorReducerArg<ICodeAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index >= 0) {
            const codes = arg.prevState.cellVMs.filter((_c, i) => i > index).map(c => concatMultilineStringInput(c.cell.data.source));
            return executeRange(arg.prevState, index, index + codes.length, [arg.payload.code, ...codes], arg.queueAction);
        }
        return arg.prevState;
    }

    export function executeAllCells(arg: NativeEditorReducerArg): IMainState {
        // This is the same thing as executing the first cell and all below
        const firstCell = arg.prevState.cellVMs.length > 0 ? arg.prevState.cellVMs[0].cell.id : undefined;
        if (firstCell) {
            return executeCellAndBelow({ ...arg, payload: { cellId: firstCell, code: concatMultilineStringInput(arg.prevState.cellVMs[0].cell.data.source) } });
        }

        return arg.prevState;
    }

    export function executeSelectedCell(arg: NativeEditorReducerArg): IMainState {
        // This is the same thing as executing the selected cell
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.prevState.selectedCellId);
        if (arg.prevState.selectedCellId && index >= 0) {
            return executeCell({ ...arg, payload: { cellId: arg.prevState.selectedCellId, code: concatMultilineStringInput(arg.prevState.cellVMs[index].cell.data.source) } });
        }

        return arg.prevState;
    }

    export function clearAllOutputs(arg: NativeEditorReducerArg): IMainState {
        const newList = arg.prevState.cellVMs.map(cellVM => {
            return { ...cellVM, cell: { ...cellVM.cell, data: { ...cellVM.cell.data, outputs: [], execution_count: null } } };
        });
        return {
            ...arg.prevState,
            cellVMs: newList
        };
    }

    export function changeCellType(arg: NativeEditorReducerArg<IChangeCellTypeAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index >= 0) {
            const cellVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];
            const newType = current.cell.data.cell_type === 'code' ? 'markdown' : 'code';
            const newCell = {
                ...current,
                inputBlockText: arg.payload.currentCode,
                cell: {
                    ...current.cell,
                    data: { ...current.cell.data, cell_type: newType, source: arg.payload.currentCode }
                }
            };
            // tslint:disable-next-line: no-any
            cellVMs[index] = (newCell as any); // This is because IMessageCell doesn't fit in here. But message cells can't change type
            if (newType === 'code') {
                arg.queueAction(createPostableAction(InteractiveWindowMessages.InsertCell,
                    { cell: cellVMs[index].cell, index, code: arg.payload.currentCode, codeCellAboveId: Helpers.firstCodeCellAbove(arg.prevState, current.cell.id) }));
            } else {
                arg.queueAction(createPostableAction(InteractiveWindowMessages.RemoveCell,
                    { id: current.cell.id }));
            }

            // When changing a cell type, also give the cell focus.
            return Effects.focusCell({ ...arg, prevState: { ...arg.prevState, cellVMs }, payload: { cellId: arg.payload.cellId, cursorPos: CursorPos.Current } });
        }

        return arg.prevState;
    }

    export function undo(arg: NativeEditorReducerArg): IMainState {
        if (arg.prevState.undoStack.length > 0) {
            // Pop one off of our undo stack and update our redo
            const cells = arg.prevState.undoStack[arg.prevState.undoStack.length - 1];
            const undoStack = arg.prevState.undoStack.slice(0, arg.prevState.undoStack.length - 1);
            const redoStack = Helpers.pushStack(arg.prevState.redoStack, arg.prevState.cellVMs);
            arg.queueAction(createPostableAction(InteractiveWindowMessages.Undo));
            return {
                ...arg.prevState,
                cellVMs: cells,
                undoStack: undoStack,
                redoStack: redoStack,
                skipNextScroll: true
            };
        }

        return arg.prevState;
    }

    export function redo(arg: NativeEditorReducerArg): IMainState {
        if (arg.prevState.redoStack.length > 0) {
            // Pop one off of our redo stack and update our undo
            const cells = arg.prevState.redoStack[arg.prevState.undoStack.length - 1];
            const redoStack = arg.prevState.redoStack.slice(0, arg.prevState.redoStack.length - 1);
            const undoStack = Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs);
            arg.queueAction(createPostableAction(InteractiveWindowMessages.Redo));
            return {
                ...arg.prevState,
                cellVMs: cells,
                undoStack: undoStack,
                redoStack: redoStack,
                skipNextScroll: true
            };
        }

        return arg.prevState;
    }
}
