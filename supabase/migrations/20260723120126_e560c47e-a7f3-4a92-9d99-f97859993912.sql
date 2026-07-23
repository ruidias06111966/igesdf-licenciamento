
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  cnae RECORD;
BEGIN
  INSERT INTO public.unidades (id, nome, tipo, cnpj, endereco, regiao_administrativa, processo_sei, observacoes, ativa)
  VALUES (
    v_id,
    'Hospital Cidade do Sol',
    'hospital',
    '28.481.233/0017-30',
    'Setor N QNN 27 Lote D, S/N, Ceilândia, RA Ceilândia, 72225-270, Brasília',
    'Ceilândia',
    'DFP2500261389',
    'Registo REDESIM nº 00000074764. Extrato de 16/07/2026: licenciamento ainda não iniciado. Área utilizada/total: 2000 m².',
    true
  );

  INSERT INTO public.cnaes_unidade (unidade_id, codigo, descricao, status) VALUES
    (v_id, '8610-1/01', 'Atividades de atendimento hospitalar', 'pendente_declaracao'),
    (v_id, '8630-5/02', 'Atividade médica ambulatorial com recursos para realização de procedimentos cirúrgicos', 'pendente_declaracao'),
    (v_id, '8640-2/02', 'Laboratórios clínicos', 'pendente_declaracao'),
    (v_id, '8640-2/05', 'Serviços de diagnóstico por imagem com uso de radiação ionizante, exceto tomografia', 'pendente_declaracao');

  FOR cnae IN
    SELECT * FROM (VALUES
      ('CNAE 8610-1/01 — Atendimento hospitalar'),
      ('CNAE 8630-5/02 — Ambulatorial com procedimentos cirúrgicos'),
      ('CNAE 8640-2/02 — Laboratório clínico'),
      ('CNAE 8640-2/05 — Diagnóstico por imagem')
    ) AS t(descricao)
  LOOP
    INSERT INTO public.licencas (unidade_id, orgao, status, descricao, observacoes) VALUES
      (v_id, 'VISA',     'pendente_declaracao', cnae.descricao, 'Pendente de declaração — processo ainda não iniciado'),
      (v_id, 'CBMDF',    'pendente_declaracao', cnae.descricao, 'Pendente de declaração — processo ainda não iniciado'),
      (v_id, 'IBRAM',    'pendente_declaracao', cnae.descricao, 'Pendente de declaração — processo ainda não iniciado'),
      (v_id, 'DF_LEGAL', 'pendente_declaracao', cnae.descricao, 'Pendente de declaração — processo ainda não iniciado'),
      (v_id, 'SUSDEC',   'pendente_declaracao', cnae.descricao, 'Pendente de declaração — processo ainda não iniciado'),
      (v_id, 'PCDF',     'vigente',             cnae.descricao, 'Concluído conforme extrato REDESIM 16/07/2026'),
      (v_id, 'SEAGRI',   'vigente',             cnae.descricao, 'Concluído conforme extrato REDESIM 16/07/2026'),
      (v_id, 'SEEDF',    'vigente',             cnae.descricao, 'Concluído conforme extrato REDESIM 16/07/2026');
  END LOOP;
END $$;
