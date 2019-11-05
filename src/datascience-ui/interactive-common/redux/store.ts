// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as Redux from 'redux';

import { Identifiers } from '../../../client/datascience/constants';
import { IMainState } from '../../interactive-common/mainState';
import { PostOffice } from '../../react-common/postOffice';
import { generateMonacoReducer, IMonacoState } from '../../react-common/redux/reducers/monaco';
import { combineReducers, createAsyncStore, QueuableAction } from '../../react-common/reduxUtils';
import { computeEditorOptions, loadDefaultSettings } from '../../react-common/settingsReactSide';
import { generatePostOfficeSendReducer } from './postOffice';

function generateDefaultState(skipDefault: boolean, baseTheme: string): IMainState {
    const defaultSettings = loadDefaultSettings();
    return {
        // tslint:disable-next-line: no-typeof-undefined
        skipDefault,
        testMode: false,
        baseTheme: defaultSettings.ignoreVscodeTheme ? 'vscode-light' : baseTheme,
        editorOptions: computeEditorOptions(defaultSettings),
        cellVMs: [],
        busy: true,
        undoStack: [],
        redoStack: [],
        submittedText: false,
        currentExecutionCount: 0,
        variables: [],
        pendingVariableCount: 0,
        debugging: false,
        knownDark: false,
        variablesVisible: false,
        editCellVM: undefined,
        enableGather: false,
        isAtBottom: true,
        font: {
            size: 14,
            family: 'Consolas, \'Courier New\', monospace'
        },
        codeTheme: Identifiers.GeneratedThemeName,
        settings: defaultSettings,
        activateCount: 0,
        monacoReady: false
    };
}

function generateMainReducer<M>(skipDefault: boolean, baseTheme: string, reducerMap: M): Redux.Reducer<IMainState, QueuableAction<M>> {
    // First create our default state.
    const defaultState = generateDefaultState(skipDefault, baseTheme);

    // Then combine that with our map of state change message to reducer
    return combineReducers<IMainState, M>(
        defaultState,
        reducerMap);
}

export function createStore<M>(skipDefault: boolean, baseTheme: string, testMode: boolean, reducerMap: M) {
    // Create a post office to listen to store dispatches and allow reducers to
    // send messages
    const postOffice = new PostOffice();

    // Create reducer for the main react UI
    const mainReducer = generateMainReducer(skipDefault, baseTheme, reducerMap);

    // Create reducer to pass window messages to the other side
    const postOfficeReducer = generatePostOfficeSendReducer(postOffice);

    // Create another reducer for handling monaco state
    const monacoReducer = generateMonacoReducer(testMode);

    // Combine these together
    const rootReducer = Redux.combineReducers({
        main: mainReducer,
        monaco: monacoReducer,
        post: postOfficeReducer
    });

    // Send this into the root reducer
    const store = createAsyncStore<{ main: IMainState; monaco: IMonacoState; post: {} }, Redux.AnyAction>(
        rootReducer);

    // Make all messages from the post office dispatch to the store, changing the type to
    // turn them into actions.
    postOffice.addHandler({
        // tslint:disable-next-line: no-any
        handleMessage(message: string, payload: any): boolean {
            // Prefix with action so that we can:
            // - Have one reducer for incoming
            // - Have another reducer for outgoing
            store.dispatch({ type: `action.${message}`, ...payload });
            return true;
        }
    });

    return store;
}
