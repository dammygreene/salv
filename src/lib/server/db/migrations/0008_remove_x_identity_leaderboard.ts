/** Remove the retired user-X identity system while preserving reward history. */
export const MIGRATION_0008_REMOVE_X_IDENTITY_LEADERBOARD = `
DROP TABLE IF EXISTS x_identities;
`;
