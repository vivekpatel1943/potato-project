1. we are never going to be adding models to the database with Base.metadata.create_all, always use alembic upgrade head to add a table or to make any sort of changes to the database table , 

2. while defining sqlalchemy models see which columns need to be indexed , which of them need to have the unique constraint and check constraints in the table arguments , and mention them with index=True , and that sort of thing. 

3. make sure that you don't index the primary key columns and columns having unique constraints as postgres automatically indexes them so if you add index=True to those columns it will be a repetition , 

4. focus on api-versioning right from the start , so right from the first api (your health-check api) , use the default endpoint , /api/v1 , 

5. 