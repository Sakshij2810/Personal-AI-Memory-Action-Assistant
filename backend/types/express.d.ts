declare global {
  namespace Express {
    interface UserSession {
      userId: string;
      email: string | null;
      name: string | null;
    }

    interface Request {
      user?: UserSession;
    }
  }
}

export {};
