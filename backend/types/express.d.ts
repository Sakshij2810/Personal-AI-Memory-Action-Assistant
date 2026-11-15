declare global {
  namespace Express {
    interface UserSession {
      id: string;
      email: string | null;
      display_name: string | null;
      firebase_uid: string;
      created_at: string;
    }

    interface Request {
      user?: UserSession;
    }
  }
}

export {};
