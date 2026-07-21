
DO $$
DECLARE v_uni uuid;
BEGIN
  INSERT INTO public.unidades (nome, tipo, cnpj, endereco, regiao_administrativa, situacao_edificacao, observacoes, ativa)
  VALUES (
    'UPA Gama', 'upa', '28.481.233/0012-25',
    'QUADRA QI 07 AREA RESERVADA 2, S/N, SETOR INDUSTRIAL (GAMA), 72445-070, BRASILIA',
    'GAMA', 'Regular',
    'Viabilidade DFP2500112672. Área utilizada/total: 1184,0 m². Certificado REDESIM 16/07/2026 (código ZE1TJq).',
    true
  ) RETURNING id INTO v_uni;

  -- CNAEs
  INSERT INTO public.cnaes_unidade (unidade_id, codigo, descricao, status) VALUES
    (v_uni, '8610-1/02', 'Atividades de atendimento em pronto-socorro e unidades hospitalares para atendimento a urgências', 'em_analise'),
    (v_uni, '8630-5/02', 'Atividade médica ambulatorial com recursos para realização de exames complementares', 'em_analise'),
    (v_uni, '8640-2/02', 'Laboratórios clínicos', 'em_analise'),
    (v_uni, '8640-2/05', 'Serviços de diagnóstico por imagem com uso de radiação ionizante, exceto tomografia', 'em_analise');

  -- DF LEGAL — todas vigentes
  INSERT INTO public.licencas (unidade_id, orgao, descricao, status, data_vencimento) VALUES
    (v_uni, 'DF_LEGAL', 'CNAE 8610-1/02 — Pronto-socorro', 'vigente', '2029-07-24'),
    (v_uni, 'DF_LEGAL', 'CNAE 8630-5/02 — Ambulatorial', 'vigente', '2027-09-20'),
    (v_uni, 'DF_LEGAL', 'CNAE 8640-2/02 — Laboratório clínico', 'vigente', '2030-07-28'),
    (v_uni, 'DF_LEGAL', 'CNAE 8640-2/05 — Diagnóstico por imagem', 'vigente', '2030-07-28');

  -- VISADF — 3 vigentes, 1 em estudo
  INSERT INTO public.licencas (unidade_id, orgao, descricao, status, data_vencimento) VALUES
    (v_uni, 'VISA', 'CNAE 8610-1/02 — Pronto-socorro', 'vigente', '2026-04-01'),
    (v_uni, 'VISA', 'CNAE 8630-5/02 — Ambulatorial', 'vigente', '2026-04-01'),
    (v_uni, 'VISA', 'CNAE 8640-2/02 — Laboratório clínico', 'vigente', '2026-07-30'),
    (v_uni, 'VISA', 'CNAE 8640-2/05 — Diagnóstico por imagem', 'em_estudo', NULL);

  -- SUSDEC
  INSERT INTO public.licencas (unidade_id, orgao, descricao, status, data_vencimento) VALUES
    (v_uni, 'SUSDEC', 'CNAE 8630-5/02 — Ambulatorial', 'vigente', '2028-07-17'),
    (v_uni, 'SUSDEC', 'CNAE 8640-2/02 — Laboratório clínico', 'dispensada', NULL),
    (v_uni, 'SUSDEC', 'CNAE 8640-2/05 — Diagnóstico por imagem', 'dispensada', NULL),
    (v_uni, 'SUSDEC', 'CNAE 8610-1/02 — Pronto-socorro', 'pendente_declaracao', NULL);

  -- CBM
  INSERT INTO public.licencas (unidade_id, orgao, descricao, status, data_vencimento) VALUES
    (v_uni, 'CBMDF', 'CNAE 8610-1/02 — Pronto-socorro', 'pendente_declaracao', NULL),
    (v_uni, 'CBMDF', 'CNAE 8630-5/02 — Ambulatorial', 'em_estudo', NULL),
    (v_uni, 'CBMDF', 'CNAE 8640-2/02 — Laboratório clínico', 'pendente_declaracao', NULL),
    (v_uni, 'CBMDF', 'CNAE 8640-2/05 — Diagnóstico por imagem', 'pendente_declaracao', NULL);

  -- IBRAM
  INSERT INTO public.licencas (unidade_id, orgao, descricao, status, data_vencimento) VALUES
    (v_uni, 'IBRAM', 'CNAE 8640-2/05 — Diagnóstico por imagem', 'dispensada', NULL),
    (v_uni, 'IBRAM', 'CNAE 8610-1/02 — Pronto-socorro', 'pendente_declaracao', NULL),
    (v_uni, 'IBRAM', 'CNAE 8630-5/02 — Ambulatorial', 'em_estudo', NULL),
    (v_uni, 'IBRAM', 'CNAE 8640-2/02 — Laboratório clínico', 'pendente_declaracao', NULL);

  -- PCDF — todos dispensados
  INSERT INTO public.licencas (unidade_id, orgao, descricao, status) VALUES
    (v_uni, 'PCDF', 'CNAE 8610-1/02 — Pronto-socorro', 'dispensada'),
    (v_uni, 'PCDF', 'CNAE 8630-5/02 — Ambulatorial', 'dispensada'),
    (v_uni, 'PCDF', 'CNAE 8640-2/02 — Laboratório clínico', 'dispensada'),
    (v_uni, 'PCDF', 'CNAE 8640-2/05 — Diagnóstico por imagem', 'dispensada');

  -- SEAGRI — todos dispensados
  INSERT INTO public.licencas (unidade_id, orgao, descricao, status) VALUES
    (v_uni, 'SEAGRI', 'CNAE 8610-1/02 — Pronto-socorro', 'dispensada'),
    (v_uni, 'SEAGRI', 'CNAE 8630-5/02 — Ambulatorial', 'dispensada'),
    (v_uni, 'SEAGRI', 'CNAE 8640-2/02 — Laboratório clínico', 'dispensada'),
    (v_uni, 'SEAGRI', 'CNAE 8640-2/05 — Diagnóstico por imagem', 'dispensada');

  -- SEEDF — todos dispensados
  INSERT INTO public.licencas (unidade_id, orgao, descricao, status) VALUES
    (v_uni, 'SEEDF', 'CNAE 8610-1/02 — Pronto-socorro', 'dispensada'),
    (v_uni, 'SEEDF', 'CNAE 8630-5/02 — Ambulatorial', 'dispensada'),
    (v_uni, 'SEEDF', 'CNAE 8640-2/02 — Laboratório clínico', 'dispensada'),
    (v_uni, 'SEEDF', 'CNAE 8640-2/05 — Diagnóstico por imagem', 'dispensada');
END $$;
