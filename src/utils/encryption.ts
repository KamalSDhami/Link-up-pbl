const encoder = new TextEncoder()
const decoder = new TextDecoder()

const SALT = 'linkup-chat-salt'
const IV_LENGTH = 12

const getSecret = () => import.meta.env.VITE_MESSAGE_ENCRYPTION_KEY || ''

async function getKey() {
  const secret = getSecret()
  if (!secret) {
    throw new Error('Missing VITE_MESSAGE_ENCRYPTION_KEY environment variable')
  }

  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 120000,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  )
}

function toBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function encryptMessage(plainText: string) {
  if (!plainText) return ''

  try {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encoder.encode(plainText)
    )

  return `${toBase64(iv)}:${toBase64(encrypted)}`
  } catch (error) {
    console.warn('Falling back to unencrypted message payload:', error)
    return plainText
  }
}

export async function decryptMessage(cipherText: string) {
  if (!cipherText) return ''
  if (!cipherText.includes(':')) return cipherText

  try {
    const [ivBase64, payload] = cipherText.split(':')
    const key = await getKey()
    const iv = fromBase64(ivBase64)
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      fromBase64(payload)
    )

    return decoder.decode(decrypted)
  } catch (error) {
    console.warn('Unable to decrypt message, returning raw payload:', error)
    return cipherText
  }
}

export function hasEncryptionKey() {
  return Boolean(getSecret())
}
