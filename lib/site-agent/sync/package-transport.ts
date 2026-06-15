import { randomBytes } from "node:crypto"
import { signSyncPackageBody } from "../../sync/package-auth"
import type { SyncPackagePayload } from "../../sync/package-schema"

interface PackageApiResponse {
  status?: string
  message?: string
  batchId?: string
}

export interface PackageTransportResult {
  status: "success" | "duplicated"
  httpStatus: number
  response: PackageApiResponse
}

export class PackageTransportError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly httpStatus: number | null
  ) {
    super(message)
    this.name = "PackageTransportError"
  }
}

export class PackageTransport {
  constructor(
    private readonly platformUrl: string,
    private readonly secret: string
  ) {}

  async send(payload: SyncPackagePayload): Promise<PackageTransportResult> {
    const rawBody = JSON.stringify(payload)
    const timestamp = String(Date.now())
    const nonce = randomBytes(16).toString("hex")
    const signature = signSyncPackageBody({
      rawBody,
      timestamp,
      nonce,
      secret: this.secret,
    }).signature

    let response: Response
    try {
      response = await fetch(
        `${this.platformUrl.replace(/\/+$/, "")}/api/sync/package`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-site-code": payload.siteCode,
            "x-timestamp": timestamp,
            "x-nonce": nonce,
            "x-signature": signature,
          },
          body: rawBody,
        }
      )
    } catch (error) {
      throw new PackageTransportError(
        `package request failed: ${
          error instanceof Error ? error.message : "network error"
        }`,
        true,
        null
      )
    }

    const body = (await response.json().catch(() => ({}))) as PackageApiResponse
    if (
      response.status === 200 &&
      (body.status === "success" || body.status === "duplicated")
    ) {
      return {
        status: body.status,
        httpStatus: response.status,
        response: body,
      }
    }

    throw new PackageTransportError(
      `package rejected: HTTP ${response.status} ${
        body.message ?? body.status ?? "unknown response"
      }`,
      response.status >= 500,
      response.status
    )
  }
}
