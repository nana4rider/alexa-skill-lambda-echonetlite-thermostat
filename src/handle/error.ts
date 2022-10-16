import { v4 as uuid } from 'uuid';

export class AlexaError extends Error {
  constructor(public type = 'INTERNAL_ERROR') {
    super(type);
  }
}

export class TemperatureError extends AlexaError {
  constructor(public minTemperature: number, public maxTemperature: number) {
    super('TEMPERATURE_VALUE_OUT_OF_RANGE');
  }
}

/**
 * エラー処理
 *
 * @param request
 * @param error
 * @returns
 */
export function handleError(request: any, error: Error) {
  const endpointId = (request.directive.endpoint?.endpointId ?? '') as string;

  const payload: any = { message: error.message };

  if (error instanceof AlexaError) {
    payload.type = error.type;

    if (error instanceof TemperatureError) {
      payload.validRange = {
        minimumValue: {
          value: error.maxTemperature,
          scale: 'CELSIUS',
        },
        maximumValue: {
          value: error.minTemperature,
          scale: 'CELSIUS',
        },
      };
    }
  } else {
    payload.type = 'INTERNAL_ERROR';
  }

  console.log('[error]', error.stack);

  return {
    event: {
      header: {
        namespace: 'Alexa',
        name: 'ErrorResponse',
        messageId: uuid(),
        payloadVersion: '3',
      },
      endpoint: {
        endpointId,
      },
      payload,
    },
  };
}
