import { supabase } from '@/integrations/supabase/client';

export interface CredentialFields {
  login?: string | null;
  password?: string | null;
  login2?: string | null;
  password2?: string | null;
  login3?: string | null;
  password3?: string | null;
  login4?: string | null;
  password4?: string | null;
  login5?: string | null;
  password5?: string | null;
}

const CREDENTIAL_FIELDS = [
  'login', 'password',
  'login2', 'password2',
  'login3', 'password3',
  'login4', 'password4',
  'login5', 'password5'
] as const;

export function useCrypto() {
  const encryptCredentials = async (data: CredentialFields): Promise<CredentialFields> => {
    const batch: { [key: string]: string | null } = {};
    
    for (const field of CREDENTIAL_FIELDS) {
      if (data[field]) {
        batch[field] = data[field];
      }
    }
    
    if (Object.keys(batch).length === 0) {
      return data;
    }
    
    try {
      const { data: result, error } = await supabase.functions.invoke('crypto', {
        body: { action: 'encrypt_batch', batch }
      });
      
      if (error) {
        console.error('Encryption error:', error);
        return data; // Return original data if encryption fails
      }
      
      const encrypted = result.encrypted || {};
      const newData = { ...data };
      
      for (const field of CREDENTIAL_FIELDS) {
        if (encrypted[field]) {
          (newData as any)[field] = encrypted[field];
        }
      }
      
      return newData;
    } catch (err) {
      console.error('Encryption error:', err);
      return data;
    }
  };
  
  const decryptCredentials = async (data: CredentialFields): Promise<CredentialFields> => {
    const batch: { [key: string]: string | null } = {};
    
    for (const field of CREDENTIAL_FIELDS) {
      if (data[field]) {
        batch[field] = data[field];
      }
    }
    
    if (Object.keys(batch).length === 0) {
      return data;
    }
    
    try {
      const { data: result, error } = await supabase.functions.invoke('crypto', {
        body: { action: 'decrypt_batch', batch }
      });
      
      if (error) {
        console.error('Decryption error:', error);
        return data;
      }
      
      const decrypted = result.decrypted || {};
      const newData = { ...data };
      
      for (const field of CREDENTIAL_FIELDS) {
        if (decrypted[field]) {
          (newData as any)[field] = decrypted[field];
        }
      }
      
      return newData;
    } catch (err) {
      console.error('Decryption error:', err);
      return data;
    }
  };
  
  const decryptSingle = async (value: string | null): Promise<string | null> => {
    if (!value) return null;
    
    try {
      const { data: result, error } = await supabase.functions.invoke('crypto', {
        body: { action: 'decrypt', data: value }
      });
      
      if (error) {
        console.error('Decryption error:', error);
        return value;
      }
      
      return result.decrypted || value;
    } catch (err) {
      console.error('Decryption error:', err);
      return value;
    }
  };
  
  return {
    encryptCredentials,
    decryptCredentials,
    decryptSingle
  };
}
