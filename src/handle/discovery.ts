import { v4 as uuid } from 'uuid';
import { ApiClient } from '../ApiClient';
import { getApiClient } from './common';

/**
 * 機器登録
 *
 * @param request
 * @returns
 */
export async function handleDiscover(request: any): Promise<any> {
  const endpoints = [];
  const client = getApiClient();
  const deviceIds = await client.getDeviceIds();
  const manufacturerName = 'ECHONET Lite Client';

  for (const id of deviceIds) {
    endpoints.push({
      // https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html
      endpointId: id,
      manufacturerName,
      friendlyName: id,
      description: `ECHONET Lite ${ApiClient.DEVICE_TYPE} ${id}`,
      displayCategories: ['THERMOSTAT', 'TEMPERATURE_SENSOR'],
      capabilities: [
        // エアコン
        {
          type: 'AlexaInterface',
          interface: 'Alexa.ThermostatController',
          version: '3',
          properties: {
            supported: [
              {
                name: 'targetSetpoint',
              },
              {
                name: 'thermostatMode',
              },
            ],
            proactivelyReported: true,
            retrievable: true,
          },
          configuration: {
            supportedModes: ['AUTO', 'COOL', 'HEAT'],
            supportsScheduling: false,
          },
        },
        // 温度計
        {
          type: 'AlexaInterface',
          interface: 'Alexa.TemperatureSensor',
          version: '3',
          properties: {
            supported: [
              {
                name: 'temperature',
              },
            ],
            proactivelyReported: true,
            retrievable: true,
          },
        },
        // ON/OFF
        {
          type: 'AlexaInterface',
          interface: 'Alexa.PowerController',
          version: '3',
          properties: {
            supported: [
              {
                name: 'powerState',
              },
            ],
            proactivelyReported: true,
            retrievable: true,
          },
        },
        // Alexa
        {
          type: 'AlexaInterface',
          interface: 'Alexa',
          version: '3',
        },
      ],
    });
  }

  return {
    event: {
      header: {
        namespace: 'Alexa.Discovery',
        name: 'Discover.Response',
        payloadVersion: '3',
        messageId: uuid(),
      },
      payload: { endpoints: endpoints },
    },
  };
}
