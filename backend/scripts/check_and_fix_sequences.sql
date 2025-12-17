-- Script para verificar y corregir secuencias de IDs en PostgreSQL
-- Ejecutar desde pgAdmin4: Tools > Query Tool > Pegar este script > Execute

-- ============================================
-- PARTE 1: VERIFICAR ESTADO DE LAS SECUENCIAS
-- ============================================
-- Este query muestra todas las tablas con secuencias y compara el máximo ID con el valor de la secuencia

DO $$
DECLARE
    r RECORD;
    sql_text TEXT;
    max_id_val INTEGER;
    seq_val BIGINT;
BEGIN
    -- Crear tabla temporal para resultados
    CREATE TEMP TABLE IF NOT EXISTS sequence_check_results (
        tabla TEXT,
        secuencia TEXT,
        valor_secuencia BIGINT,
        max_id_tabla INTEGER,
        diferencia INTEGER,
        estado TEXT
    );
    
    TRUNCATE TABLE sequence_check_results;
    
    -- Recorrer todas las secuencias
    FOR r IN 
        SELECT 
            sequencename,
            REGEXP_REPLACE(sequencename, '_id_seq$', '') AS table_name,
            last_value
        FROM pg_sequences
        WHERE schemaname = 'public'
          AND sequencename LIKE '%_id_seq'
    LOOP
        BEGIN
            -- Construir query dinámico para obtener MAX(id) de cada tabla
            sql_text := format('SELECT COALESCE(MAX(id), 0) FROM "%s"', r.table_name);
            EXECUTE sql_text INTO max_id_val;
            
            seq_val := r.last_value;
            
            -- Insertar resultado
            INSERT INTO sequence_check_results VALUES (
                r.table_name,
                r.sequencename,
                seq_val,
                max_id_val,
                max_id_val - seq_val::INTEGER,
                CASE 
                    WHEN seq_val < max_id_val THEN '❌ DESINCRONIZADA'
                    WHEN seq_val = max_id_val THEN '⚠️ En el límite (próximo será ' || (max_id_val + 1) || ')'
                    ELSE '✅ OK'
                END
            );
        EXCEPTION WHEN OTHERS THEN
            -- Si hay error (tabla no existe, etc), ignorar
            RAISE NOTICE 'Error procesando tabla %: %', r.table_name, SQLERRM;
        END;
    END LOOP;
    
    -- Mostrar resultados
    RAISE NOTICE E'\n==========================================\nRESULTADO DEL CHEQUEO DE SECUENCIAS\n==========================================\n';
END $$;

-- Mostrar los resultados
SELECT 
    tabla AS "Tabla",
    valor_secuencia AS "Valor Actual de Secuencia",
    max_id_tabla AS "Máximo ID en Tabla",
    diferencia AS "Diferencia",
    estado AS "Estado",
    secuencia AS "Nombre de Secuencia"
FROM sequence_check_results
ORDER BY 
    CASE 
        WHEN diferencia > 0 THEN 1
        WHEN diferencia = 0 THEN 2
        ELSE 3
    END,
    tabla;

-- ============================================
-- PARTE 2: CORREGIR SECUENCIAS (EJECUTAR SOLO SI ES NECESARIO)
-- ============================================
-- Este bloque corrige automáticamente todas las secuencias desincronizadas
-- Descomentar las líneas siguientes para ejecutar

/*
DO $$
DECLARE
    r RECORD;
    sql_text TEXT;
    max_id_val INTEGER;
    fixed_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Iniciando corrección de secuencias...';
    
    -- Recorrer todas las secuencias desincronizadas
    FOR r IN 
        SELECT secuencia, tabla, max_id_tabla
        FROM sequence_check_results
        WHERE diferencia > 0 OR diferencia = 0
        ORDER BY tabla
    LOOP
        BEGIN
            -- Obtener MAX(id) actual (por si cambió)
            sql_text := format('SELECT COALESCE(MAX(id), 1) FROM "%s"', r.tabla);
            EXECUTE sql_text INTO max_id_val;
            
            -- Corregir la secuencia
            sql_text := format('SELECT setval(''%s'', %s, true)', r.secuencia, max_id_val);
            EXECUTE sql_text;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE '✓ Corregida: % -> secuencia % ajustada a %', r.tabla, r.secuencia, max_id_val;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '✗ Error corrigiendo %: %', r.tabla, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Corrección completada. % secuencias ajustadas.', fixed_count;
END $$;

-- Ejecutar nuevamente la PARTE 1 para verificar que se corrigieron
SELECT 'Ejecutar nuevamente la PARTE 1 para verificar' AS "Mensaje";
*/

-- ============================================
-- ALTERNATIVA SIMPLE: Corrección manual por tabla
-- ============================================
-- Si prefieres corregir manualmente tabla por tabla, puedes usar estas queries
-- (descomenta solo la que necesites):

-- SELECT setval('"ValorJUS_id_seq"', (SELECT COALESCE(MAX(id), 1) FROM "ValorJUS"), true);
-- SELECT setval('"Usuario_id_seq"', (SELECT COALESCE(MAX(id), 1) FROM "Usuario"), true);
-- SELECT setval('"Cliente_id_seq"', (SELECT COALESCE(MAX(id), 1) FROM "Cliente"), true);
-- SELECT setval('"Caso_id_seq"', (SELECT COALESCE(MAX(id), 1) FROM "Caso"), true);
-- -- ... etc
