/**
 * Streamly — usePairing Hook
 *
 * Manages pairing code generation, validation, and session state.
 */

import { useState, useCallback } from 'react';
import { generatePairingCode, normalizePairingCode } from '../services/signaling.js';

const PAIRING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function usePairing() {
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  const generateCode = useCallback(() => {
    const newCode = generatePairingCode();
    setCode(newCode);
    setIsExpired(false);

    // Set expiry timer
    setTimeout(() => {
      setIsExpired(true);
    }, PAIRING_TIMEOUT_MS);

    return newCode;
  }, []);

  const validateCode = useCallback((input) => {
    const normalized = normalizePairingCode(input);
    return normalized.length === 6 && /^\d{6}$/.test(normalized);
  }, []);

  const formatCodeInput = useCallback((value) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '').slice(0, 6);
    // Add space after 3rd digit
    if (digits.length > 3) {
      return digits.slice(0, 3) + ' ' + digits.slice(3);
    }
    return digits;
  }, []);

  return {
    code,
    inputCode,
    setInputCode,
    isExpired,
    generateCode,
    validateCode,
    formatCodeInput,
  };
}
