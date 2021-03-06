const path = require('path');
const fs = require('fs');
import invariant from 'invariant';
import uniqBy from 'lodash/uniqBy';
const camelCase = require('./camelCase');
const SPACE = '  ';

function getSpaces(count = 1) {
  let result = '';
  for (let i = 0; i < count; i++) {
    result += SPACE;
  }
  return result;
}

function getActionName(action) {
  if (action && action.name) return action.name.toUpperCase();
  return undefined;
}
// action
function getCreateActionStr(...actions) {
  invariant(uniqBy(actions, 'name').length === actions.length, 'Expected action name not repeat');
  const exportActionMethods = [];
  const actionMethods = [];
  const actionNames = [];
  actions.forEach(value => {
    const action = getActionName(value);
    const result = `${action}_RESULT`;
    actionNames.push(`'${action}', '${result}'`);
    actionMethods.push(`${camelCase(action)}, ${camelCase(result)}`);
    exportActionMethods.push(camelCase(action));
  });
  const res = `const {
${getSpaces()}${actionMethods.join(`,\n${getSpaces()}`)}
} = createActions(${actionNames.join(`,\n${getSpaces(2)}`)});

export { ${exportActionMethods.join(', ')} };`;
  return res;
}


// reducers
function getHandleActionStr(...actions) {
  let str = `export default handleActions({\n`;
  const handles = [];
  actions.forEach(value => {
    invariant(value && value.name, 'Expected action to be a object {name:\'\'}');
    const action = getActionName(value);
    const result = `${action}_RESULT`;
    handles.push(`${getSpaces()}${action}: (state) => ({
${getSpaces(2)}...state,
${getSpaces(2)}isfetching: true
${getSpaces()}}),
${getSpaces()}${result}: (state, action) => ({
${getSpaces(2)}...state,
${getSpaces(2)}isfetching: false,
${getSpaces(2)}${camelCase(result)}: action.payload
${getSpaces()}})`);
  });
  str = `${str}${handles.join(',\n')}\n}, {});`;
  return str;
}
function getRequestStr(action) {
  if (!action) throw new Error('param is not undefined.');
  const method = (action.method || 'get').toLowerCase();
  if (!action.url) throw new Error('request url is not undefined.');
  if (method === 'get') {
    return `const res = yield call(axios.get, ${action.url}${action.params ? ', { params: data.payload }' : ''});`;
  } else {
    return `const res = yield call(axios.${method}, ${action.url}${action.params ? ', data.payload' : ''});`;
  }
}
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
// saga
function createSagaStr(progress, ...actions) {
  let result = '';
  actions.forEach(action => {
    const actionName = getActionName(action);
    const actionResultName = actionName + '_RESULT';
    const sagaName = `${camelCase(actionName)}Saga`;
    result +=
      `function* ${sagaName}(${action.params ? 'data' : ''}) {
${getSpaces()}try {
${progress ? `${getSpaces(2)}yield put(beginTask());\n` : ''}\n${getSpaces(2)}${getRequestStr(action)}\n${progress ? `\n${getSpaces(2)}yield put(${camelCase(actionResultName)}(res));` : ''}
${getSpaces()}} catch (error) {
${getSpaces(2)}yield put(${camelCase(actionResultName)}(error));
${getSpaces()}} ${progress ? `finally {\n${getSpaces(2)}yield put(endTask());\n${getSpaces()}}` : ''}
}

export function* watch${capitalizeFirstLetter(sagaName)}() {
${getSpaces()}yield takeEvery(${camelCase(actionName)}, ${sagaName});
}`;
  });
  return result;
}

function getActionAndReducer(...actions) {
  return `// beging not modify
${getCreateActionStr(...actions)}

${getHandleActionStr(...actions)}
// ending not modify`;
}


function createSagaFile(opts) {
  const { filename, extraImport, progress, actions } = opts;

  const result = `
import { createActions, handleActions } from 'redux-actions';
import { call, put, takeEvery } from 'redux-saga/effects';
import axios from 'axios';
${progress ? 'import { beginTask, endTask } from \'redux-nprogress\';' : ''}
${extraImport}

${getActionAndReducer(...actions)}

${createSagaStr(progress, ...actions)}`;
  return `${result.substr(1)}\n`;
}
export { getActionAndReducer, createSagaStr, getSpaces, getActionName, getCreateActionStr, getHandleActionStr, getRequestStr, capitalizeFirstLetter };

export default createSagaFile;
