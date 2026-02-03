// Temporary map - to be moved to separate table in future
const USER_MAP: Record<string, string> = {
    '0dccf5b1-c9c7-4ea7-b478-579cafc769e1': 'Bartek',
    'd0b9cb11-4db0-4618-baee-9b87029b67a1': 'Bartek',
};

export const mapUserIdToUserName = (userId: string): string => {
    return USER_MAP[userId] || 'Inny';
};
