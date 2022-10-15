import { DateTime } from 'luxon';
import { v4 as uuid } from 'uuid';
import { DeviceProperties, OperationMode } from '../ApiClient';
import { getApiClient } from './common';
import { AlexaError, TemperatureError } from './error';

/**
 * 自動 | 冷房 | 暖房 | 送風 | 除湿 | オフ | カスタム
 */
type AlexaThermostatMode =
  | 'AUTO'
  | 'COOL'
  | 'HEAT'
  | 'FAN'
  | 'DEHUMIDIFY'
  | 'OFF'
  | 'CUSTOM';

/**
 * Alexa操作モードを取得します。
 *
 * @param operationStatus ECHONET動作状態
 * @param operationMode ECHONET運転モード設定
 * @returns
 */
export function getAlexaThermostatMode(
  operationStatus: boolean,
  operationMode: OperationMode,
): AlexaThermostatMode {
  if (!operationStatus) {
    return 'OFF';
  }

  switch (operationMode) {
    case 'auto':
      return 'AUTO';
    case 'cooling':
      return 'COOL';
    case 'heating':
      return 'HEAT';
  }
  return 'CUSTOM';
}

/**
 * ECHONET運転モードを取得します。
 *
 * @param mode Alexa操作モード
 * @param customName カスタム名
 * @returns
 */
export function getEchonetOperationMode(
  mode: AlexaThermostatMode,
  customName: string,
): OperationMode | null {
  switch (mode) {
    case 'AUTO':
      return 'auto';
    case 'COOL':
      return 'cooling';
    case 'HEAT':
      return 'heating';
    case 'FAN':
      return 'circulation';
    case 'DEHUMIDIFY':
      return 'dehumidification';
    case 'CUSTOM':
      switch (customName) {
        case 'DEHUMIDIFY': // 発話: 除湿
          return 'dehumidification';
        case 'FAN': // 発話: 送風
          return 'circulation';
      }
      console.log('[Custom Operation Mode]', mode);
      break;
  }
  return null;
}

/**
 * 温度指定(絶対値)
 * https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html#settargettemperature-directive
 *
 * @param request
 * @returns
 */
export async function handleSetTargetTemperature(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;

  const client = getApiClient();

  let properties = await client.getProperties(endpointId);

  if (properties.operationMode === 'circulation') {
    throw new AlexaError('NOT_IN_OPERATION');
  }

  // 整数のみ
  const targetSetpoint = Math.trunc(
    request.directive.payload.targetSetpoint.value,
  );

  // 設定範囲外の温度で、風量を設定させる隠しコマンド(ThermostatControllerに風量がサポートされたら移行)
  // 50:自動 51~58:風量
  const baseWindTemp = 50;
  if (targetSetpoint === baseWindTemp) {
    await client.updateProperties(endpointId, {
      airFlowLevel: 'auto',
    });
  } else if (
    targetSetpoint >= baseWindTemp + 1 &&
    targetSetpoint <= baseWindTemp + 8
  ) {
    const airFlowLevel = targetSetpoint - baseWindTemp + 1;
    await client.updateProperties(endpointId, { airFlowLevel });
  } else {
    let minTemperature = 0;
    let maxTemperature = 50;
    if (properties.productCode === '43532d303030303030303030') {
      // panasonic Eolia
      minTemperature = 16;
      maxTemperature = 30;
    }

    if (targetSetpoint < minTemperature || targetSetpoint > maxTemperature) {
      throw new TemperatureError(minTemperature, maxTemperature);
    }

    const updateProperties: Partial<DeviceProperties> = {
      targetTemperature: targetSetpoint,
      operationStatus: true,
    };

    await client.updateProperties(endpointId, updateProperties);
    properties = Object.assign(properties, updateProperties);
  }

  return {
    event: {
      header: {
        namespace: 'Alexa',
        name: 'Response',
        messageId: uuid(),
        correlationToken: request.directive.header.correlationToken,
        payloadVersion: '3',
      },
      endpoint: {
        endpointId,
      },
      payload: {},
    },
    context: {
      properties: createReports(properties, 0),
    },
  };
}

/**
 * 温度指定(相対値)
 * https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html#adjusttargettemperature-directive
 *
 * @param request
 * @returns
 */
export async function handleAdjustTargetTemperature(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;

  const client = getApiClient();

  let properties = await client.getProperties(endpointId);

  if (properties.operationMode === 'circulation') {
    throw new AlexaError('NOT_IN_OPERATION');
  }

  // 整数のみ
  const targetSetpointDelta = Math.trunc(
    request.directive.payload.targetSetpointDelta.value,
  );
  const targetSetpoint = properties.targetTemperature + targetSetpointDelta;

  let minTemperature = 0;
  let maxTemperature = 50;
  if (properties.productCode === '43532d303030303030303030') {
    // panasonic Eolia
    minTemperature = 16;
    maxTemperature = 30;
  }

  if (targetSetpoint < minTemperature || targetSetpoint > maxTemperature) {
    throw new TemperatureError(minTemperature, maxTemperature);
  }

  const updateProperties: Partial<DeviceProperties> = {
    targetTemperature: targetSetpoint,
    operationStatus: true,
  };

  await client.updateProperties(endpointId, updateProperties);
  properties = Object.assign(properties, updateProperties);

  return {
    event: {
      header: {
        namespace: 'Alexa',
        name: 'Response',
        messageId: uuid(),
        correlationToken: request.directive.header.correlationToken,
        payloadVersion: '3',
      },
      endpoint: {
        endpointId,
      },
      payload: {},
    },
    context: {
      properties: createReports(properties, 0),
    },
  };
}

/**
 * モード指定
 * https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html#setthermostatmode-directive
 *
 * @param request
 * @returns
 */
export async function handleSetThermostatMode(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;

  const client = getApiClient();

  let properties = await client.getProperties(endpointId);

  const thermostatMode: AlexaThermostatMode =
    request.directive.payload.thermostatMode.value;
  const customName: string =
    request.directive.payload.thermostatMode.customName;
  const operationMode = getEchonetOperationMode(thermostatMode, customName);

  const updateProperties: Partial<DeviceProperties> = operationMode
    ? {
        operationMode,
        operationStatus: true,
      }
    : {
        operationStatus: false,
      };

  await client.updateProperties(endpointId, updateProperties);
  properties = Object.assign(properties, updateProperties);

  return {
    event: {
      header: {
        namespace: 'Alexa',
        name: 'Response',
        messageId: uuid(),
        correlationToken: request.directive.header.correlationToken,
        payloadVersion: '3',
      },
      endpoint: {
        endpointId,
      },
      payload: {},
    },
    context: {
      properties: createReports(properties, 0),
    },
  };
}

/**
 * Power
 *
 * @param request
 * @param power
 * @returns
 */
export async function handlePower(request: any, power: 'ON' | 'OFF') {
  const endpointId = request.directive.endpoint.endpointId as string;

  const client = getApiClient();

  let properties = await client.getProperties(endpointId);

  const updateProperties: Partial<DeviceProperties> = {
    operationStatus: power === 'ON',
  };

  await client.updateProperties(endpointId, updateProperties);
  properties = Object.assign(properties, updateProperties);

  return {
    event: {
      header: {
        namespace: 'Alexa',
        name: 'Response',
        messageId: uuid(),
        correlationToken: request.directive.header.correlationToken,
        payloadVersion: '3',
      },
      endpoint: {
        endpointId,
      },
      payload: {},
    },
    context: {
      properties: createReports(properties, 0),
    },
  };
}

/**
 * 変更レポートを作成します。
 *
 * @param properties
 * @param uncertainty
 * @returns 変更レポート
 */
export function createReports(
  properties: DeviceProperties,
  uncertainty: number,
) {
  const now = DateTime.local().toISO();
  const thermostatMode: AlexaThermostatMode = getAlexaThermostatMode(
    properties.operationStatus,
    properties.operationMode,
  );
  // 0度に設定すると、Alexaアプリで操作できなくなる
  const targetSetpoint =
    !properties.operationStatus || properties.operationMode === 'circulation'
      ? 0
      : properties.targetTemperature;

  return [
    // モード指定
    {
      namespace: 'Alexa.ThermostatController',
      name: 'thermostatMode',
      value: thermostatMode,
      timeOfSample: now,
      uncertaintyInMilliseconds: uncertainty,
    },
    // 温度指定
    {
      namespace: 'Alexa.ThermostatController',
      name: 'targetSetpoint',
      value: {
        value: targetSetpoint,
        scale: 'CELSIUS',
      },
      timeOfSample: now,
      uncertaintyInMilliseconds: uncertainty,
    },
    // 温度計
    {
      namespace: 'Alexa.TemperatureSensor',
      name: 'temperature',
      value: {
        value: properties.roomTemperature,
        scale: 'CELSIUS',
      },
      timeOfSample: now,
      uncertaintyInMilliseconds: uncertainty,
    },
    // ON/OFF
    {
      namespace: 'Alexa.PowerController',
      name: 'powerState',
      value: properties.operationStatus ? 'ON' : 'OFF',
      timeOfSample: now,
      uncertaintyInMilliseconds: uncertainty,
    },
  ];
}
