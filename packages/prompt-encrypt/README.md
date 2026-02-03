# prompt-encrypt

Encrypt prompts at rest and in transit using AES-256-GCM encryption.

## Installation

```bash
npm install -g prompt-encrypt
# or
npx prompt-encrypt
```

## Usage

### Generate an encryption key

```bash
prompt-encrypt generate-key
prompt-encrypt generate-key --output ./my-key.key
```

### Lock (encrypt) a file

```bash
prompt-encrypt lock ./prompts/secret.txt --key $PROMPT_ENCRYPT_KEY
prompt-encrypt lock ./prompts/secret.txt --key ./my-key.key
prompt-encrypt lock ./prompts/secret.txt --key abc123...
```

### Lock an entire directory

```bash
prompt-encrypt lock ./prompts --directory --key $PROMPT_ENCRYPT_KEY
prompt-encrypt lock ./prompts -d --patterns "**/*.txt,**/*.prompt"
```

### Unlock (decrypt) a file

```bash
prompt-encrypt unlock ./prompts/secret.txt.encrypted --key $PROMPT_ENCRYPT_KEY
prompt-encrypt unlock ./prompts/secret.txt.encrypted --key ./my-key.key
```

### Unlock an entire directory

```bash
prompt-encrypt unlock ./prompts --directory --key $PROMPT_ENCRYPT_KEY
```

### Rotate encryption keys

```bash
prompt-encrypt rotate-key --directory ./prompts --old-key $OLD_KEY --new-key $NEW_KEY
prompt-encrypt rotate-key -d ./prompts --old-key ./old.key  # Generates new key
```

### Verify file integrity

```bash
prompt-encrypt verify ./prompts/secret.txt.encrypted
```

### View encrypted file info

```bash
prompt-encrypt info ./prompts/secret.txt.encrypted
```

## Key Management

### Environment Variables

Set `PROMPT_ENCRYPT_KEY` with a hex-encoded 256-bit key:

```bash
export PROMPT_ENCRYPT_KEY=a1b2c3d4e5f6...  # 64 hex characters
```

### Key File

Save the key to a file and reference it:

```bash
prompt-encrypt generate-key --output ./secrets/prompt.key
prompt-encrypt lock file.txt --key ./secrets/prompt.key
```

### Environment Variable Reference

Use `$VAR_NAME` syntax to read from environment:

```bash
prompt-encrypt lock file.txt --key $MY_SECRET_KEY
```

## Encryption Details

- **Algorithm**: AES-256-GCM (Authenticated Encryption)
- **Key Length**: 256 bits (32 bytes)
- **IV**: 128 bits (randomly generated per encryption)
- **Authentication Tag**: 128 bits (GCM mode)
- **Key Derivation**: PBKDF2 with SHA-512

## Output Format

Encrypted files are stored as JSON:

```json
{
  "version": 1,
  "algorithm": "aes-256-gcm",
  "iv": "base64...",
  "salt": "base64...",
  "authTag": "base64...",
  "ciphertext": "base64...",
  "metadata": {
    "originalFile": "secret.txt",
    "encryptedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Options

All commands support:

- `--json` - Output in JSON format
- `--help` - Show help for the command

## Security Best Practices

1. **Never commit keys to version control**
2. **Use environment variables in production**
3. **Rotate keys periodically**
4. **Delete key files after loading into secure storage**
5. **Use separate keys for different environments**

## License

MIT
