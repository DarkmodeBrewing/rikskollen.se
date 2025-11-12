export interface DatabaseConfig {
  connectionString: string;
}

export const getDatabaseConfig = (): DatabaseConfig => {
  const connectionString = process.env.DB_URL;

  if (!connectionString) {
    throw new Error('DB_URL environment variable is required');
  }

  return { connectionString };
};
