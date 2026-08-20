# Como contribuir com o Projeto X

Obrigado pelo interesse em melhorar o Projeto X. Contribuições técnicas, correções de documentação e relatos reproduzíveis ajudam a tornar a experiência mais estável e acessível.

## Antes de começar

- Consulte as [issues abertas](https://github.com/fa9958189/projeto-x/issues) para evitar trabalho duplicado.
- Use as [Discussions](https://github.com/fa9958189/projeto-x/discussions) para ideias ainda abertas, dúvidas e propostas que precisam de alinhamento.
- Para mudanças maiores, descreva primeiro o problema, o comportamento esperado e a solução sugerida.

## Contribuições bem-vindas

- correções de bugs e problemas de compatibilidade;
- melhorias de acessibilidade e experiência de uso;
- otimizações de renderização, rastreamento e consumo de recursos;
- aprimoramentos dos shaders e das interações por gestos;
- testes, documentação e exemplos reproduzíveis.

## Ambiente de desenvolvimento

Requisitos: Node.js 20 ou superior e uma webcam para validar as interações.

```bash
npm ci
npm run dev
```

Antes de enviar uma contribuição, execute:

```bash
npm run typecheck
npm run build
```

## Fluxo recomendado

1. Faça um fork do repositório.
2. Crie uma branch curta e descritiva, como `fix/camera-permission` ou `docs/improve-controls`.
3. Mantenha cada alteração focada em um único objetivo.
4. Use mensagens de commit claras e objetivas.
5. Abra uma pull request explicando o problema, a solução e como o resultado foi validado.

## Checklist da pull request

- [ ] A alteração possui escopo claro e não inclui arquivos sem relação com o objetivo.
- [ ] O typecheck e o build foram executados com sucesso.
- [ ] Mudanças visuais ou interativas foram testadas em uma origem segura (`localhost` ou HTTPS).
- [ ] O README ou outros documentos foram atualizados quando necessário.
- [ ] Nenhum segredo, frame de webcam ou dado biométrico foi incluído.

## Privacidade

O processamento da câmera deve permanecer local ao navegador. Qualquer proposta que envolva transmissão, gravação ou armazenamento de imagens exige discussão prévia e uma justificativa clara de privacidade e segurança.
