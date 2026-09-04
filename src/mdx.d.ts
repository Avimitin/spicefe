declare module '*.mdx.js' {
  import type { ComponentType } from 'react';

  const MDXContent: ComponentType<{
    components?: Record<string, ComponentType<any>>;
  }>;
  export default MDXContent;
}
