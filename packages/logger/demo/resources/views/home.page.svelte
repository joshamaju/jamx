<script lang="ts">
  import Document from "./components/document.entry.svelte";
</script>

<Document>
  <svelte:fragment slot="head">
    <link rel="stylesheet" href="./style.css" />
    <script type="module" src="./script.ts"></script>
  </svelte:fragment>

  <main id="terminal"></main>
</Document>
