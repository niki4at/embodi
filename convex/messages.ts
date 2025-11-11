import { query } from './_generated/server';

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error('Not authenticated');
    }
    return {
      subject: identity.subject,
      email: identity.email ?? null,
      name: (identity as any).name ?? null,
    };
  },
});


