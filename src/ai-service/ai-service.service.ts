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

export interface SimilarityRequest {
  text1: string;
  text2: string;
  threshold?: number;
}

export interface SimilarityResponse {
  distance: number;
  is_similar: boolean;
  threshold_used: number;
}

export interface GroupRequest {
  ideas: string[];
  threshold?: number;
}

export interface GroupResponse {
  groups: Record<string, string[]>;
  n_groups: number;
  threshold_used: number;
  distance_matrix: number[][];
}

@Injectable()
export class AiServiceService {
  private readonly baseUrl = process.env.JAMAL_AI_SERVICE_URL || 'https://dikdns-jamal-ai-service.hf.space';

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

  async checkSimilarity(request: SimilarityRequest): Promise<SimilarityResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/similarity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new HttpException(
          `AI Service similarity check failed: ${response.statusText} - ${errorBody}`,
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

  async groupIdeas(request: GroupRequest): Promise<GroupResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new HttpException(
          `AI Service group ideas failed: ${response.statusText} - ${errorBody}`,
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
