const grayMatter = jest.fn().mockImplementation((content: string) => {
  // Frontmatter parser mock
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const [, frontmatter, body] = match;
    const data: Record<string, any> = {};

    // Check for invalid YAML patterns
    if (frontmatter.includes('invalid yaml:') && frontmatter.includes('[') && !frontmatter.includes(']')) {
      throw new Error('Invalid YAML frontmatter');
    }

    // Parse simple key: value pairs
    frontmatter.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        data[key.trim()] = valueParts.join(':').trim();
      }
    });

    return {
      data,
      content: body.trim(),
      excerpt: '',
      orig: content,
    };
  }

  return {
    data: {},
    content: content,
    excerpt: '',
    orig: content,
  };
});

export default grayMatter;
