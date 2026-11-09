declare module 'qrcode' {
  export interface QRCodeOptions {
    width?: number
    margin?: number
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    color?: { dark?: string; light?: string }
  }

  const QRCode: {
    toDataURL(value: string, options?: QRCodeOptions): Promise<string>
  }

  export default QRCode
}
