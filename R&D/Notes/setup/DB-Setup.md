PostgreSQL commands – Memora AI

1. Check whether PostgreSQL is installed
   brew list | grep postgresql

2. Check PostgreSQL service status
   brew services list

Look for:
postgresql@15 started

3. Start PostgreSQL
   brew services start postgresql@15

4. Stop PostgreSQL
   brew services stop postgresql@15

5. Restart PostgreSQL
   brew services restart postgresql@15

6. List all databases
   psql -l

If the output opens in a pager showing (END), press q to exit.

Alternative without the pager:
psql -l -P pager=off

7. Create your project database
   createdb memora_ai

8. Verify database creation
   psql -l

9. Connect to your project database
   psql -d memora_ai

10. Check current database
    Inside PostgreSQL:
    SELECT current_database();

11. List tables
    Inside PostgreSQL:
    \dt

12. Exit PostgreSQL terminal
    \q
