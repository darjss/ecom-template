# Өрнүүн 48 prototype media manifest

**Status:** reviewed candidate media for [Prototype the fictional reference store and canary fixture](https://github.com/darjss/ecom-template/issues/28), generated 2026-07-14. All assets are fictional prototype inputs, not merchant media.

## Provenance

- Source: OpenAI Codex `image_generation` tool
- Image model: `gpt-image-2`
- Routing model: `gpt-5.5`
- Rights: [OpenAI Services Agreement §4](https://openai.com/policies/services-agreement/)
- Final format: 1000 × 1000 WebP, stripped and quality-compressed after generation
- Shared prompt: photorealistic catalog photography on a pale birch pantry shelf against a warm cream wall, bright Ulaanbaatar apartment-kitchen daylight from upper left, soft shadow down-right, modest household realism, clean crop margins, and no people, brands, readable text, pseudo-text, logos, barcodes, QR codes, known trade dress, or watermarks.

## Assets

| Asset | Prompt-specific subject | SHA-256 |
| --- | --- | --- |
| `hero-pantry` | Complete canonical assortment arranged as one orderly pantry display | `003b24d2360a0be42ba339bef750cf838cd80fcf71d6b46edd9f138537ad406a` |
| `p01-rice` | One resealable 1 kg white-rice pouch with a clear grain window | `e0b05283a7e3df961a9d7da2a982c2dcbf3033734222b0ff8d2ee58f50be04d3` |
| `p02-flour` | One matte 1 kg flour pouch with a blank oat band | `8c034b6093de4af2a0f548af11c813c83e9a62e3e03d42ec0d49b1990ff4c0a8` |
| `p03-milk` | One plain 1 L refrigerated milk bottle | `3719a85261c9a75b014fd26f0660d094bd4e0aa6ab9f5db372e426fd1d49ae27` |
| `p04-oil` | One clear 1 L vegetable-oil bottle with a yellow cap | `dd8ad1d1187f2951e824e934cdfb38e156df6511b1e55172745fb866b499af44` |
| `p05-detergent-800` | Compact 800 g detergent pouch with a blank leaf-green block | `4ac12fd01b5efc5bd9f5704d2f1c60082943a0928050cfec14266ff891d4189d` |
| `p05-detergent-1600` | Matching larger 1.6 kg detergent pouch | `32eff39641e506746b3c84f5994e68de9fe295e918867045be21307c3911ece5` |
| `p06-dish-liquid` | Plain 500 ml translucent dish-liquid bottle | `0e8fe169ecc9721d379f914445fde6af99fe3ad6350ee60c1905ac5357f20b07` |
| `p07-tote-sand` | Unprinted everyday cotton tote in sand beige | `cc24a5f95d5be04c339fbbeda8be33b108a91c66fbbc8784879ce60371ebb094` |
| `p07-tote-sky` | Unprinted everyday cotton tote in sky blue | `146b0076a01b98df94333f51d3cc1b941cf979630b42172efb736a01d3b9be0b` |
| `p08-notebook` | Blank clothbound notebook tied with a sky-blue ribbon | `b3117910ba4eb60e4367b350d414e10ae16e90d81a39d1494e12dfcb8d7bad33` |
| `p09-sugar-cubes` | Plain 500 g sugar-cube carton with a clear window | `e9661d55921ef464b5c0d98f08e4d843784f34a4f5168cc1ee098996d80df3c2` |
| `b01-cleaning-bundle` | Exactly one 800 g detergent and one 500 ml dish liquid | `4e9bc824200514d5dbe7e27b31a69dbe679bebeca48a7ca632b4319522fa7a7e` |
| `b02-pantry-bundle` | Exactly two rice pouches, one flour pouch, and one oil bottle | `702051bb8b7cdd91669967ac8c9e1858d681fa6f4a5eb7f2b66fe16664d6184a` |

## Human review

Accepted for prototype use: no real merchant identity, people, brands, readable generated packaging text, barcodes, QR codes, or obvious malformed products are present. The detergent sizes, tote colors, and Bundle component counts remain visibly distinguishable. Semantic product names, prices, SKUs, and accessibility descriptions stay in HTML rather than imagery.
