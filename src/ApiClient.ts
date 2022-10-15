import axios, { AxiosInstance, AxiosResponse } from 'axios';

class ApiClient {
  public static readonly DEVICE_TYPE = 'homeAirConditioner';

  private client: AxiosInstance;

  constructor(baseURL: string, authorization: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept-Language': 'ja-jp',
        'Accept-Encoding': 'gzip',
        Authorization: authorization,
      },
    });
  }

  async getDeviceIds(): Promise<DeviceId[]> {
    const response: AxiosResponse<any[]> = await this.client.get('/devices');
    return response.data
      .filter((d) => d.deviceType === ApiClient.DEVICE_TYPE)
      .map((d) => d.id);
  }

  async getProperties(id: string): Promise<DeviceProperties> {
    const response: AxiosResponse<DeviceProperties> = await this.client.get(
      `/devices/${id}/properties`,
    );
    return response.data;
  }

  async updateProperties(
    id: string,
    properties: Partial<DeviceProperties>,
  ): Promise<void> {
    await this.client.put(`/devices/${id}/properties`, properties);
  }

  async reloadProperties(
    id: string,
    ...propertyNames: [DevicePropertyName, ...DevicePropertyName[]]
  ): Promise<void> {
    for (const name of propertyNames) {
      await this.wait(1000);
      await this.client.put(`/devices/${id}/properties/${name}/request`, {});
    }
  }

  private wait = (t: number) =>
    new Promise((resolve) => setTimeout(resolve, t));
}

type DeviceId = string;

type OperationMode =
  | 'auto'
  | 'cooling'
  | 'heating'
  | 'dehumidification'
  | 'circulation'
  | 'other';

type DevicePropertyName = keyof DeviceProperties;

interface DeviceProperties {
  id: DeviceId;
  operationStatus: boolean;
  operationMode: OperationMode;
  targetTemperature: number;
  airFlowLevel: 'auto' | number;
  productCode: string;
  roomTemperature: number;
}

export { ApiClient, OperationMode, DeviceProperties };
