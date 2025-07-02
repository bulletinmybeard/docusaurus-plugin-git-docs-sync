import { MDXValidator } from '../mdx-validator';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('MDXValidator', () => {
  const mockContentPath = '/test/content';
  let validator: MDXValidator;

  beforeEach(() => {
    validator = new MDXValidator(mockContentPath);
    jest.clearAllMocks();
  });

  describe('validateFiles', () => {
    it('should return valid result for empty file list', async () => {
      const result = await validator.validateFiles([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip ignored files', async () => {
      validator = new MDXValidator(mockContentPath, ['*.draft.md']);
      const result = await validator.validateFiles(['test.draft.md']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid MDX file', async () => {
      const validMDX = `---
title: Test
---

# Hello World

This is a valid MDX file.

<Button>Click me</Button>
`;
      (fs.readFile as jest.Mock).mockResolvedValue(validMDX);

      const result = await validator.validateFiles(['test.mdx']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch MDX syntax errors', async () => {
      const invalidMDX = `---
title: Test
---

# Hello World

<Button>Unclosed tag
`;
      (fs.readFile as jest.Mock).mockResolvedValue(invalidMDX);

      const result = await validator.validateFiles(['test.mdx']);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe('test.mdx');
      expect(result.errors[0].error).toContain('Unexpected end of file');
    });

    it('should catch invalid frontmatter', async () => {
      const invalidFrontmatter = `---
title: Test
invalid yaml: [
---

# Hello World
`;
      (fs.readFile as jest.Mock).mockResolvedValue(invalidFrontmatter);

      const result = await validator.validateFiles(['test.md']);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should validate multiple files', async () => {
      const validMDX = `# Valid file`;
      const invalidMDX = `<Unclosed>`;

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(validMDX)
        .mockResolvedValueOnce(invalidMDX);

      const result = await validator.validateFiles(['valid.md', 'invalid.mdx']);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe('invalid.mdx');
    });
  });
});
