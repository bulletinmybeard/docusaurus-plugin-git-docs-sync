export const compile = jest.fn().mockImplementation(async (content: string) => {
  if (content.includes('<Button>') && !content.includes('</Button>')) {
    throw new Error('Unexpected end of file, expected a closing tag for <Button>');
  }
  if (content.includes('<Unclosed>') && !content.includes('</Unclosed>')) {
    throw new Error('Unexpected end of file, expected a closing tag for <Unclosed>');
  }
  if (content.includes('{') && !content.includes('}')) {
    throw new Error('Unexpected token');
  }
  return {
    value: 'mock-compiled-mdx',
    data: {},
  };
});

export const compileSync = jest.fn();
