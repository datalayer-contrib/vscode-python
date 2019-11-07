// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import {
    IOpenLinkAction,
    ISendCommandAction,
    IShowDataViewerAction,
    IShowPlotAction
} from '../../../native-editor/redux/actions';
import { extractInputText, IMainState } from '../../mainState';
import { createPostableAction } from '../postOffice';
import { CommonReducerArg, ICellAction, IEditCellAction } from './types';

// These are all reducers that don't actually change state. They merely dispatch a message to the other side.
export namespace Transfer {
    export function exportCells<T>(arg: CommonReducerArg<T>): IMainState {
        const cellContents = arg.prevState.cellVMs.map(v => v.cell);
        arg.queueAction(createPostableAction(InteractiveWindowMessages.Export, cellContents));
        return arg.prevState;
    }

    export function save<T>(arg: CommonReducerArg<T>): IMainState {
        // Note: this is assuming editor contents have already been saved. That should happen as a result of focus change

        // Actually waiting for save results before marking as not dirty, so don't do it here.
        arg.queueAction(createPostableAction(InteractiveWindowMessages.SaveAll, { cells: arg.prevState.cellVMs.map(cvm => cvm.cell) }));
        return arg.prevState;
    }

    export function showDataViewer<T>(arg: CommonReducerArg<T, IShowDataViewerAction>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.ShowDataViewer, { variableName: arg.payload.variableName, columnSize: arg.payload.columnSize }));
        return arg.prevState;
    }

    export function sendCommand<T>(arg: CommonReducerArg<T, ISendCommandAction>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.NativeCommand, { command: arg.payload.command, source: arg.payload.commandType }));
        return arg.prevState;
    }

    export function showPlot<T>(arg: CommonReducerArg<T, IShowPlotAction>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.ShowPlot, arg.payload.imageHtml));
        return arg.prevState;
    }

    export function openLink<T>(arg: CommonReducerArg<T, IOpenLinkAction>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.OpenLink, arg.payload.uri.toString()));
        return arg.prevState;
    }

    export function getAllCells<T>(arg: CommonReducerArg<T>): IMainState {
        const cells = arg.prevState.cellVMs.map(c => c.cell);
        arg.queueAction(createPostableAction(InteractiveWindowMessages.ReturnAllCells, cells));
        return arg.prevState;
    }

    export function gotoCell<T>(arg: CommonReducerArg<T, ICellAction>): IMainState {
        const cellVM = arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.cellId);
        if (cellVM && cellVM.cell.data.cell_type === 'code') {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.GotoCodeCell, { file: cellVM.cell.file, line: cellVM.cell.line }));
        }
        return arg.prevState;
    }

    export function copyCellCode<T>(arg: CommonReducerArg<T, ICellAction>): IMainState {
        let cellVM = arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.cellId);
        if (!cellVM && arg.prevState.editCellVM && arg.payload.cellId === arg.prevState.editCellVM.cell.id) {
            cellVM = arg.prevState.editCellVM;
        }

        // Send a message to the other side to jump to a particular cell
        if (cellVM) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.CopyCodeCell, { source: extractInputText(cellVM.cell, arg.prevState.settings) }));
        }

        return arg.prevState;
    }

    export function gather<T>(arg: CommonReducerArg<T, ICellAction>): IMainState {
        const cellVM = arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.cellId);
        if (cellVM) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.GatherCodeRequest, cellVM.cell));
        }
        return arg.prevState;
    }

    export function editCell<T>(arg: CommonReducerArg<T, IEditCellAction>): IMainState {
        if (arg.payload.cellId) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.EditCell, { changes: arg.payload.changes, id: arg.payload.cellId }));
        }
        return arg.prevState;
    }

}
