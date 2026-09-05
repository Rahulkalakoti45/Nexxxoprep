export const ERROR_CODES = {
  CONNECTION_LOST: 'CONNECTION_LOST',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  ELEVENLABS_CAPACITY: 'ELEVENLABS_CAPACITY',
  MICROPHONE_UNAVAILABLE: 'MICROPHONE_UNAVAILABLE',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TRANSPORT_FAILED: 'TRANSPORT_FAILED',
  RECONNECT_TIMEOUT: 'RECONNECT_TIMEOUT',
  RECONNECT_EXHAUSTED: 'RECONNECT_EXHAUSTED',
  INTERNAL: 'INTERNAL',
}

const USER_MESSAGES = {
  [ERROR_CODES.CONNECTION_LOST]: 'Connection lost. Click Reconnect to continue the interview.',
  [ERROR_CODES.AI_UNAVAILABLE]: 'AI service is temporarily unavailable. Please try again in a moment.',
  [ERROR_CODES.ELEVENLABS_CAPACITY]: 'AI interviewer is temporarily busy. Please wait a few seconds and retry.',
  [ERROR_CODES.MICROPHONE_UNAVAILABLE]: 'Microphone is unavailable. Check permissions and device settings.',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Session token expired. Click Reconnect to start a fresh voice connection.',
  [ERROR_CODES.TRANSPORT_FAILED]: 'Voice transport failed. Click Reconnect to restore the interview.',
  [ERROR_CODES.RECONNECT_TIMEOUT]: 'Reconnection timed out. Click Reconnect to try again.',
  [ERROR_CODES.RECONNECT_EXHAUSTED]: 'Connection lost. Click Reconnect to continue the interview.',
  [ERROR_CODES.INTERNAL]: 'Something went wrong. Please try reconnecting.',
}

export function categorizeConversationError(error) {
  const message = error?.message || String(error || '')
  const lower = message.toLowerCase()

  if (message.includes('429') || /maximum concurrent capacity/i.test(message)) {
    return { code: ERROR_CODES.ELEVENLABS_CAPACITY, message: USER_MESSAGES[ERROR_CODES.ELEVENLABS_CAPACITY] }
  }
  if (/notallowed|permission|microphone|getusermedia/i.test(lower)) {
    return { code: ERROR_CODES.MICROPHONE_UNAVAILABLE, message: USER_MESSAGES[ERROR_CODES.MICROPHONE_UNAVAILABLE] }
  }
  if (/token|expired|401|403|unauthorized/i.test(lower)) {
    return { code: ERROR_CODES.TOKEN_EXPIRED, message: USER_MESSAGES[ERROR_CODES.TOKEN_EXPIRED] }
  }
  if (/webrtc|transport|ice|disconnect/i.test(lower)) {
    return { code: ERROR_CODES.TRANSPORT_FAILED, message: USER_MESSAGES[ERROR_CODES.TRANSPORT_FAILED] }
  }
  if (/timeout|timed out/i.test(lower)) {
    return { code: ERROR_CODES.RECONNECT_TIMEOUT, message: USER_MESSAGES[ERROR_CODES.RECONNECT_TIMEOUT] }
  }
  if (/unavailable|502|503|upstream/i.test(lower)) {
    return { code: ERROR_CODES.AI_UNAVAILABLE, message: USER_MESSAGES[ERROR_CODES.AI_UNAVAILABLE] }
  }
  if (/internal server error/i.test(lower)) {
    return { code: ERROR_CODES.INTERNAL, message: USER_MESSAGES[ERROR_CODES.INTERNAL] }
  }

  return { code: ERROR_CODES.CONNECTION_LOST, message: message || USER_MESSAGES[ERROR_CODES.CONNECTION_LOST] }
}
