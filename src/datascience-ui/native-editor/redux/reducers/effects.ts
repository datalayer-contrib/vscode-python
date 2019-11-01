// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IMainState, CursorPos } from '../../../interactive-common/mainState';
import { ICellAction, ICellAndCursorAction, ICodeAction } from '../actions';
import { NativeEditorReducerArg } from '../mapping';

export namespace Effects {
    export function focusCell(arg: NativeEditorReducerArg<ICellAndCursorAction>): IMainState {
        const newVMs = [...arg.prevState.cellVMs];

        // Focus one cell and unfocus another. Focus should always gain selection too.
        const addFocusIndex = newVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        let removeFocusIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.focusedCellId);
        if (removeFocusIndex < 0) {
            removeFocusIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.selectedCellId);
        }
        if (addFocusIndex >= 0) {
            newVMs[addFocusIndex] = { ...newVMs[addFocusIndex], focused: true, selected: true, cursorPos: arg.payload.cursorPos };
        }
        if (removeFocusIndex >= 0) {
            newVMs[removeFocusIndex] = { ...newVMs[removeFocusIndex], focused: false, selected: false };
        }
        return {
            ...arg.prevState,
            cellVMs: newVMs,
            focusedCellId: arg.payload.cellId,
            selectedCellId: arg.payload.cellId
        };
    }

    export function unfocusCell(arg: NativeEditorReducerArg<ICodeAction>): IMainState {
        // Unfocus the currently focused cell and change its code
        const focusedCell = arg.prevState.focusedCellId || arg.payload.cellId;
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === focusedCell);
        if (index >= 0) {
            const newVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];
            const newCell = {
                ...current,
                focused: false,
                cell: {
                    ...current.cell,
                    data: {
                        ...current.cell.data,
                        source: arg.payload.code
                    }
                }
            };

            // tslint:disable-next-line: no-any
            newVMs[index] = (newCell as any); // This is because IMessageCell doesn't fit in here

            return {
                ...arg.prevState,
                cellVMs: newVMs,
                focusedCellId: undefined
            };
        }

        return arg.prevState;
    }

    export function selectCell(arg: NativeEditorReducerArg<ICellAndCursorAction>): IMainState {
        const newVMs = [...arg.prevState.cellVMs];

        // Select one cell and unselect another.
        const addIndex = newVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        const removeIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.selectedCellId);
        if (addIndex >= 0) {
            newVMs[addIndex] = {
                ...newVMs[addIndex],
                focused: arg.prevState.focusedCellId !== undefined && arg.prevState.focusedCellId === arg.prevState.selectedCellId,
                selected: true,
                cursorPos: arg.payload.cursorPos
            };
        }
        if (removeIndex >= 0) {
            newVMs[removeIndex] = { ...newVMs[removeIndex], focused: false, selected: false };
        }
        return {
            ...arg.prevState,
            cellVMs: newVMs,
            focusedCellId: arg.prevState.focusedCellId !== undefined ? arg.payload.cellId : undefined,
            selectedCellId: arg.payload.cellId
        };
    }

    export function toggleLineNumbers(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index >= 0) {
            const newVMs = [...arg.prevState.cellVMs];
            newVMs[index] = { ...newVMs[index], showLineNumbers: !newVMs[index].showLineNumbers };
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function toggleOutput(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index >= 0) {
            const newVMs = [...arg.prevState.cellVMs];
            newVMs[index] = { ...newVMs[index], hideOutput: !newVMs[index].hideOutput };
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function selectNextCell(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index < arg.prevState.cellVMs.length - 1) {
            return selectCell({ ...arg, payload: { cellId: arg.prevState.cellVMs[index + 1].cell.id, cursorPos: CursorPos.Current } });
        }

        return arg.prevState;
    }

    export function notebookDirty(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            dirty: true
        };
    }

    export function notebookClean(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            dirty: false
        };
    }
}
