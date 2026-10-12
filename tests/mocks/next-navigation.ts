export const nextNavigationMock = {
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && /^(REDIRECT:|NOT_FOUND)/.test(error.message)) throw error;
  },
};
