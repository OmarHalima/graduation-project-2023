import { Pool } from 'pg'; // Import PostgreSQL client

// Initialize your PostgreSQL connection pool
const pool = new Pool({
    connectionString: 'your_connection_string_here', // Update with your connection string
});

// Function to delete a CV
async function deleteCV(cvId: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
        // Check if the user exists
        const userCheckQuery = 'SELECT * FROM users WHERE id = $1';
        const userCheckResult = await client.query(userCheckQuery, [userId]);

        if (userCheckResult.rowCount === 0) {
            throw new Error('User does not exist.');
        }

        // Proceed to delete the CV
        const deleteQuery = 'DELETE FROM user_cvs WHERE id = $1';
        const deleteResult = await client.query(deleteQuery, [cvId]);

        if (deleteResult.rowCount === 0) {
            throw new Error('CV not found or could not be deleted.');
        }

        console.log('CV deleted successfully.');
    } catch (error) {
        console.error('Error deleting CV:', error.message);
        throw error; // Rethrow the error for further handling
    } finally {
        client.release();
    }
}

// Export the deleteCV function for use in other files
export { deleteCV }; 