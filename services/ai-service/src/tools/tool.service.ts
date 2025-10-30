import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class ToolService {
  private coreApiUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.coreApiUrl = this.configService.get<string>('CORE_API_URL') || 'http://localhost:3001';
  }

  // Tools that AI can call to interact with Core API
  
  async getObjectives(workspaceId: string) {
    const response = await firstValueFrom(
      this.httpService.get<any>(`${this.coreApiUrl}/objectives?workspaceId=${workspaceId}`) as any,
    ) as AxiosResponse<any>;
    return response.data;
  }

  async createObjective(data: any) {
    const response = await firstValueFrom(
      this.httpService.post<any>(`${this.coreApiUrl}/objectives`, data) as any,
    ) as AxiosResponse<any>;
    return response.data;
  }

  async updateObjective(id: string, data: any) {
    const response = await firstValueFrom(
      this.httpService.patch<any>(`${this.coreApiUrl}/objectives/${id}`, data) as any,
    ) as AxiosResponse<any>;
    return response.data;
  }

  // Add more tools as needed for AI personas to interact with the system
}

