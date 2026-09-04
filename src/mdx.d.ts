declare module '*.mdx.js' {
  import type { ComponentType } from 'react';

  const MDXContent: ComponentType<Record<string, never>>;
  export default MDXContent;
}
