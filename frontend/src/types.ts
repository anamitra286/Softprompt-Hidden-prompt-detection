export interface Detection {
  detected: boolean
  reason: string
  encrypted: boolean
  integrity_ok: boolean
  version: number | null
  encoding_method: string | null
  payload_bytes: number | null
  text: string | null
  body_sha256: string | null
  expected_sha256: string | null
}

export interface ScanResponse {
  detection: Detection
  image: {
    filename: string | null
    format: string | null
    mode: string
    width: number
    height: number
    size_bytes: number
    capacity_bytes: number
    lossless: boolean
  }
  sha256: string
  safety_notice: string
}

export interface CapacityResponse {
  width: number
  height: number
  format: string | null
  mode: string
  size_bytes: number
  capacity_bytes: number
  header_bytes: number
  usable_text_bytes: number
  lossless: boolean
  sha256: string
}

export interface EncodeResponse {
  ok: boolean
  encoding_method: string
  encrypted: boolean
  message_chars: number
  packet_bytes: number
  header_bytes: number
  capacity_bytes: number
  capacity_used_percent: number
  psnr_db: number | null
  original: { filename: string | null; format: string | null; size_bytes: number; sha256: string }
  encoded: {
    filename: string
    format: string
    size_bytes: number
    sha256: string
    data_url: string
  }
}

export interface AnalyzeResponse {
  file: {
    filename: string
    format: string
    mode: string
    size_bytes: number
    sha256: string
    lossless: boolean
  }
  dimensions: {
    width: number
    height: number
    pixels: number
    capacity_bytes: number
    usable_text_bytes: number
  }
  rgb_stats: Record<string, { mean: number; std: number; min: number; max: number; entropy: number }>
  overall_entropy: number
  lsb: {
    ones: number
    zeros: number
    total: number
    ratio_ones: number
    per_channel_ratio: Record<string, number>
    chi_square: number
  }
  payload: Detection
  verdict: string
  disclaimer: string
}

export interface TestCase {
  name: string
  image: string
  image_format: string
  dimensions: string
  message_chars: number
  payload_bytes: number
  encrypted: boolean
  expected_success: boolean
  passed: boolean
  detail: string
  psnr_db: number | null
  duration_ms: number
}

export interface SuiteResponse {
  total: number
  passed: number
  failed: number
  success_rate: number
  duration_ms: number
  cases: TestCase[]
}
