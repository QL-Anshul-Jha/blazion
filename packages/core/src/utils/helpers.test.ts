import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ResponseType, BlazionErrorCode } from './enums';
import { BlazionError } from './types';
import {
  buildQueryString, mergeHeaders, parseResponseBody, handleResponseError, resolvePayloadAndHeaders
} from './helpers';

describe('buildQueryString', () => {
  test('serializes primitives and skips null/undefined', () => {
    const qs = buildQueryString({ page: 1, active: true, name: 'a b', skip: null, missing: undefined });
    assert.equal(qs, 'page=1&active=true&name=a+b');
  });

  test('returns empty string when no query given', () => {
    assert.equal(buildQueryString(undefined), '');
  });

  test('throws TypeError for non-primitive values', () => {
    assert.throws(
      () => buildQueryString({ page: { nested: true } as never }),
      /Invalid parameter type for key "page"/
    );
  });
});

describe('mergeHeaders', () => {
  test('custom headers override defaults, case-insensitively', () => {
    const merged = mergeHeaders(
      { 'X-Global': 'global', 'X-Override': 'old' },
      { 'x-override': 'new', 'X-Local': 'local' }
    );
    assert.equal(merged['x-global'], 'global');
    assert.equal(merged['x-override'], 'new');
    assert.equal(merged['x-local'], 'local');
  });
});

describe('resolvePayloadAndHeaders', () => {
  test('passes FormData through untouched and untyped', () => {
    const headers = new Headers();
    const form = new FormData();
    const result = resolvePayloadAndHeaders(form, headers);
    assert.equal(result, form);
    assert.equal(headers.has('Content-Type'), false);
  });

  test('serializes plain objects to JSON and sets Content-Type', () => {
    const headers = new Headers();
    const result = resolvePayloadAndHeaders({ a: 1 }, headers);
    assert.equal(result, '{"a":1}');
    assert.equal(headers.get('Content-Type'), 'application/json');
  });

  test('does not override an explicitly-set Content-Type', () => {
    const headers = new Headers({ 'Content-Type': 'application/vnd.api+json' });
    resolvePayloadAndHeaders({ a: 1 }, headers);
    assert.equal(headers.get('Content-Type'), 'application/vnd.api+json');
  });

  test('sniffs JSON-looking strings', () => {
    const headers = new Headers();
    resolvePayloadAndHeaders('{"a":1}', headers);
    assert.equal(headers.get('Content-Type'), 'application/json');
  });

  test('falls back to text/plain for plain strings', () => {
    const headers = new Headers();
    resolvePayloadAndHeaders('hello world', headers);
    assert.equal(headers.get('Content-Type'), 'text/plain');
  });

  test('returns undefined when no body given', () => {
    const headers = new Headers();
    assert.equal(resolvePayloadAndHeaders(undefined, headers), undefined);
  });
});

describe('parseResponseBody', () => {
  test('parses JSON responses', async () => {
    const res = new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    const data = await parseResponseBody(res, ResponseType.JSON);
    assert.deepEqual(data, { ok: true });
  });

  test('parses text responses', async () => {
    const res = new Response('plain text');
    const data = await parseResponseBody(res, ResponseType.TEXT);
    assert.equal(data, 'plain text');
  });
});

describe('handleResponseError', () => {
  test('does nothing for ok responses', () => {
    const res = new Response('{}', { status: 200 });
    assert.doesNotThrow(() => handleResponseError(res, ResponseType.JSON, {}, { url: '/x', method: 'GET' }));
  });

  test('throws a BlazionError mapped from the status code', () => {
    const res = new Response('{}', { status: 404, statusText: 'Not Found' });
    assert.throws(() => {
      handleResponseError(res, ResponseType.JSON, { message: 'nope' }, { url: '/x', method: 'GET' });
    }, (err) => {
      assert.ok(err instanceof BlazionError);
      assert.equal(err.code, BlazionErrorCode.NOT_FOUND);
      assert.equal(err.status, 404);
      return true;
    });
  });
});
