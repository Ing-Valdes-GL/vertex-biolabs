from pyspark.sql.functions import desc, count, avg

# Imaginons que nous avons chargé les données dans 'df_patients'
# 1. Top 10 diagnostics
top_diagnostics = df_patients.groupBy("diagnostic") \
    .agg(count("*").alias("nombre_cas")) \
    .orderBy(desc("nombre_cas")) \
    .limit(10)

top_diagnostics.show()