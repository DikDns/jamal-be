import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

export interface HealthResponse {
    status: string;
    model_loaded: boolean;
    model_loading: boolean;
    tokenizer_loaded: boolean;
    error?: string | null;
}

export interface DebugResponse {
    cwd: string;
    model_path: string;
    model_exists: boolean;
    model_contents: string[];
    tokenizer_exists: boolean;
    model_loaded: boolean;
    tokenizer_loaded: boolean;
    error: string | null;
    tf_version: string;
}

@Injectable()
export class AiServiceService {
    private readonly baseUrl = 'https://dikdns-jamal-ai-service.hf.space';

    async getHealth(): Promise<HealthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            if (!response.ok) {
                throw new HttpException(
                    `AI Service health check failed: ${response.statusText}`,
                    HttpStatus.BAD_GATEWAY,
                );
            }
            return await response.json();
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                `Failed to connect to AI Service: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    async getDebug(): Promise<DebugResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/debug`);
            if (!response.ok) {
                throw new HttpException(
                    `AI Service debug failed: ${response.statusText}`,
                    HttpStatus.BAD_GATEWAY,
                );
            }
            return await response.json();
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                `Failed to connect to AI Service: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }
}
