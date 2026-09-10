## Question

Vilka konkreta källor får agenten använda för försäkring, service, däck och reparationer, och vilka av dem kan nås på ett stabilt och tillåtet sätt?

## Resolution

Den första agentversionen ska inte hämta Transportstyrelseuppgifter, annonsdata eller bränslepriser. Dessa hanteras av befintliga flöden och inställningar.

- Försäkring: Hedvigs offentliga statistik är fast riktmärke. Individuella offerter och personnummer/BankID-flöden ingår inte i agentens automatiska scope.
- Service och standardreparationer: Mekonomen som generellt riktpris, med märkesverkstad som jämförelse eller modell-/garantispecifik källa.
- Däck: endast Däckonline i första versionen.
- Bränslepris: hämtas inte av agenten; värdet kommer från appens inställningar.
