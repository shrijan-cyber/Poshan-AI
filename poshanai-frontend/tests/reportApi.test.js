import assert from 'node:assert/strict';
import test from 'node:test';
import client from '../src/api/client.js';
import { uploadReport } from '../src/api/reportApi.js';

test('report upload preserves multipart FormData and lets the transport set its boundary', async (t) => {
  const originalAdapter = client.defaults.adapter;
  let observedConfig;
  client.defaults.adapter = async (config) => {
    observedConfig = config;
    return {
      data: { success: true, data: { report: { id: 'report-1' } } },
      status: 202,
      statusText: 'Accepted',
      headers: {},
      config,
    };
  };
  t.after(() => { client.defaults.adapter = originalAdapter; });

  const file = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
  const response = await uploadReport(file);

  assert.equal(response.report.id, 'report-1');
  assert.ok(observedConfig.data instanceof FormData);
  assert.equal(observedConfig.data.get('file').name, 'blob');
  assert.equal(observedConfig.headers.get('Content-Type'), null);
});
