<script lang="ts">
  import type { MathNode, ContainerRef } from './mathModel';
  import BracketWrapper from '../components/BracketWrapper.svelte';
  import IntegralWrapper from '../components/IntegralWrapper.svelte';
  import SqrtWrapper from '../components/SqrtWrapper.svelte';
  import LongdivWrapper from '../components/LongdivWrapper.svelte';
  import UnderbraceWrapper from '../components/UnderbraceWrapper.svelte';
  import { getDisplayStrokeColor } from '../utils/inkColor';
  
  export let nodes: MathNode[] = [];
  export let isMe: boolean = true;
  
  // Dummy container path since it's only needed for exponentScale calculation
  export let containerPath: ContainerRef[] = [];
  
  function getNodeStyleColor(color?: string): string {
    if (!color) return '';
    const displayColor = getDisplayStrokeColor(color, isMe);
    return `color: ${displayColor};`;
  }
  
  function exponentScale(path: ContainerRef[]) {
    const nestingDepth = path.filter(c => c.slot === 'exponent' || c.slot === 'subscript' || c.slot === 'superscript').length;
    const raw = Math.pow(0.72, nestingDepth);
    return Math.max(raw, 0.6);
  }

  function hasExponent(nodes: MathNode[]): boolean {
    if (!nodes || !Array.isArray(nodes)) return false;
    for (const n of nodes) {
      if (n.type === 'exponent') return true;
      if ((n.type === 'bracket' || n.type === 'integral') && n.superscript && n.superscript.length > 0) return true;
      if (n.type === 'fraction' && (hasExponent(n.numerator) || hasExponent(n.denominator))) return true;
      if (n.type === 'exponent' && (hasExponent(n.base) || hasExponent(n.exponent))) return true;
      if (n.type === 'subscript' && (hasExponent(n.base) || hasExponent(n.subscript))) return true;
      if (n.type === 'sqrt' && hasExponent(n.content)) return true;
      if (n.type === 'nthroot' && (hasExponent(n.index) || hasExponent(n.content))) return true;
      if (n.type === 'longdiv' && (hasExponent(n.index) || hasExponent(n.content) || hasExponent(n.quotient || []))) return true;
      if (n.type === 'bracket' && (hasExponent(n.content) || hasExponent(n.subscript || []) || hasExponent(n.superscript || []))) return true;
      if (n.type === 'integral' && (hasExponent(n.content) || hasExponent(n.subscript || []) || hasExponent(n.superscript || []))) return true;
    }
    return false;
  }
</script>

{#each nodes as node (node.id)}{#if node.type === 'char'}<span class="math-char" data-node-id={node.id} style={getNodeStyleColor(node.color)}>{node.value}</span>{:else if node.type === 'fraction'}
    <span class="math-fraction" data-node-id={node.id} style={getNodeStyleColor(node.color)}>
      <span class="numerator">
        <span class="numerator-inner">
          <svelte:self
            nodes={node.numerator}
            {isMe}
            containerPath={[...containerPath, { nodeId: node.id, slot: 'numerator' }]}
          />
        </span>
      </span>
      <span class="denominator" class:has-exponent={hasExponent(node.denominator)}>
        <span class="denominator-inner">
          <svelte:self
            nodes={node.denominator}
            {isMe}
            containerPath={[...containerPath, { nodeId: node.id, slot: 'denominator' }]}
          />
        </span>
      </span>
    </span>
  {:else if node.type === 'exponent'}
    <span class="math-exponent-group" data-node-id={node.id} style={getNodeStyleColor(node.color)}>
      <span class="base">
        <svelte:self
          nodes={node.base}
          {isMe}
          containerPath={[...containerPath, { nodeId: node.id, slot: 'base' }]}
        />
      </span>
      <span class="exponent" style="font-size: {exponentScale([...containerPath, { nodeId: node.id, slot: 'exponent' }])}em;">
        <svelte:self
          nodes={node.exponent}
          {isMe}
          containerPath={[...containerPath, { nodeId: node.id, slot: 'exponent' }]}
        />
      </span>
    </span>
  {:else if node.type === 'sqrt'}
    <span class="math-sqrt" data-node-id={node.id} style={getNodeStyleColor(node.color)}>
      <SqrtWrapper>
        <span class="radicand">
          <svelte:self
            nodes={node.content}
            {isMe}
            containerPath={[...containerPath, { nodeId: node.id, slot: 'content' }]}
          />
        </span>
      </SqrtWrapper>
    </span>
  {:else if node.type === 'nthroot'}
    <span class="math-sqrt" data-node-id={node.id} style={getNodeStyleColor(node.color)}>
      <SqrtWrapper index={indexSnippet}>
        {#snippet indexSnippet()}
          <span class="nthroot-index">
            <svelte:self
              nodes={node.index}
              {isMe}
              containerPath={[...containerPath, { nodeId: node.id, slot: 'index' }]}
            />
          </span>
        {/snippet}
        <span class="radicand">
          <svelte:self
            nodes={node.content}
            {isMe}
            containerPath={[...containerPath, { nodeId: node.id, slot: 'content' }]}
          />
        </span>
      </SqrtWrapper>
    </span>
  
  {:else if node.type === 'longdiv'}
    <span class="math-longdiv" data-node-id={node.id} style={getNodeStyleColor(node.color)}>
      <LongdivWrapper index={indexSnippet} quotient={node.quotient && node.quotient.length > 0 ? quotientSnippet : null}>
        {#snippet indexSnippet()}
          <span class="longdiv-index">
            <svelte:self nodes={node.index} {isMe} />
          </span>
        {/snippet}
        {#snippet quotientSnippet()}
          <span class="longdiv-quotient">
            <svelte:self nodes={node.quotient} {isMe} />
          </span>
        {/snippet}
        <span class="radicand">
          <svelte:self nodes={node.content} {isMe} />
        </span>
      </LongdivWrapper>
    </span>
  {:else if node.type === 'subscript'}
    <span class="math-subscript-group" data-node-id={node.id} style={getNodeStyleColor(node.color)}>
      <span class="base">
        <svelte:self
          nodes={node.base}
          {isMe}
          containerPath={[...containerPath, { nodeId: node.id, slot: 'base' }]}
        />
      </span>
      <span class="subscript" style="font-size: {exponentScale([...containerPath, { nodeId: node.id, slot: 'subscript' }])}em;">
        <svelte:self
          nodes={node.subscript}
          {isMe}
          containerPath={[...containerPath, { nodeId: node.id, slot: 'subscript' }]}
        />
      </span>
    </span>
  {:else if node.type === 'bracket'}
    <span class="math-bracket" data-node-id={node.id} style={getNodeStyleColor(node.color)}>
      <BracketWrapper type={node.bracketKind} closed={node.closed !== false}>
        <span class="bracket-content">
          <svelte:self
            nodes={node.content}
            {isMe}
            containerPath={[...containerPath, { nodeId: node.id, slot: 'content' }]}
          />
        </span>
      </BracketWrapper>
      {#if (node.bracketKind === 'square' || node.bracketKind === 'evaluation') && (node.subscript || node.superscript)}
        <span class="bracket-evaluation-limits">
          <span class="evaluation-superscript" style="font-size: {exponentScale([...containerPath, { nodeId: node.id, slot: 'superscript' }])}em;">
            <svelte:self
              nodes={node.superscript || []}
              {isMe}
              containerPath={[...containerPath, { nodeId: node.id, slot: 'superscript' }]}
            />
          </span>
          <span class="evaluation-subscript" style="font-size: {exponentScale([...containerPath, { nodeId: node.id, slot: 'subscript' }])}em;">
            <svelte:self
              nodes={node.subscript || []}
              {isMe}
              containerPath={[...containerPath, { nodeId: node.id, slot: 'subscript' }]}
            />
          </span>
        </span>
      {/if}
    </span>
  {:else if node.type === 'integral'}
    <span class="math-bracket" data-node-id={node.id} style={getNodeStyleColor(node.color)}>
      <IntegralWrapper>
        <span slot="limits" class="integral-limits" style="margin-right: 2px;">
          {#if node.subscript || node.superscript}
            <span class="integral-superscript" style="font-size: {exponentScale([...containerPath, { nodeId: node.id, slot: 'superscript' }])}em;">
              <svelte:self
                nodes={node.superscript || []}
                {isMe}
                containerPath={[...containerPath, { nodeId: node.id, slot: 'superscript' }]}
              />
            </span>
            <span class="integral-subscript" style="font-size: {exponentScale([...containerPath, { nodeId: node.id, slot: 'subscript' }])}em;">
              <svelte:self
                nodes={node.subscript || []}
                {isMe}
                containerPath={[...containerPath, { nodeId: node.id, slot: 'subscript' }]}
              />
            </span>
          {/if}
        </span>
        <span class="bracket-content">
          <svelte:self
            nodes={node.content}
            {isMe}
            containerPath={[...containerPath, { nodeId: node.id, slot: 'content' }]}
          />
        </span>
      </IntegralWrapper>
    </span>
  {:else if node.type === 'underbrace'}
    <span class="math-underbrace" data-node-id={node.id} style={getNodeStyleColor(node.color)}>
      <UnderbraceWrapper label={labelSnippet}>
        {#snippet labelSnippet()}
          <span class="underbrace-label">
            <svelte:self
              nodes={node.label}
              {isMe}
              containerPath={[...containerPath, { nodeId: node.id, slot: 'label' }]}
            />
          </span>
        {/snippet}
        <span class="underbrace-content">
          <svelte:self
            nodes={node.content}
            {isMe}
            containerPath={[...containerPath, { nodeId: node.id, slot: 'content' }]}
          />
        </span>
      </UnderbraceWrapper>
    </span>
  {/if}{/each}

<style>
  .math-char {
    display: inline;
    white-space: pre-wrap;
  }
  .math-fraction {
    display: inline-grid;
    grid-template-rows: 1fr auto 1fr;
    grid-template-columns: 1fr;
    vertical-align: middle;
    margin: 0 0.2em;
    position: relative;
    line-height: 1;
    text-align: center;
  }
  .math-fraction::after {
    content: '';
    grid-row: 2;
    grid-column: 1;
    width: 100%;
    border-top: 2px solid currentColor;
    margin: 0.1em 0;
  }
  .numerator {
    grid-row: 1;
    align-self: end;
    justify-self: center;
    width: 100%;
    min-width: 0.8em;
    position: relative;
    padding-bottom: 0.15em;
    top: 8px;
  }
  .numerator-inner {
    display: inline-flex;
    align-items: flex-end;
    white-space: nowrap;
    line-height: 0.8;
    padding: 0 0.1em;
  }
  :global(.numerator-inner:has(.math-fraction) > :not(.math-fraction)) {
    position: relative;
    top: -1.05em;
  }
  .denominator {
    grid-row: 3;
    align-self: start;
    justify-self: center;
    width: 100%;
    min-width: 0.8em;
    position: relative;
    padding-top: 0.15em;
  }
  .denominator.has-exponent {
    padding-top: 0.35em;
  }
  .denominator-inner {
    display: inline-flex;
    align-items: flex-start;
    white-space: nowrap;
    line-height: 0.8;
    padding: 0 0.1em;
  }
  :global(.denominator-inner:has(.math-fraction) > .math-fraction) {
    top: -10px;
  }
  :global(.denominator-inner:has(.math-fraction) > :not(.math-fraction)) {
    position: relative;
    top: 6px;
  }
  .math-exponent-group {
    display: inline-block;
  }
  .base {
    display: inline-block;
  }
  .exponent {
    display: inline-block;
    vertical-align: 0.5em;
    margin-left: 0.1em;
    position: relative;
    left: -4px;
    min-height: 1em;
    min-width: 0.5em;
  }
  .math-sqrt {
    display: inline-flex;
    align-items: center;
    margin: 0 0.1em;
  }
  .radicand {
    display: inline-flex;
    align-items: center;
    min-width: 14px;
    min-height: 20px;
  }
  .longdiv-index {
    display: inline-flex;
    min-width: 0.6em;
    min-height: 0.8em;
    align-items: center;
    justify-content: center;
    position: relative;
    padding-right: 2px;
  }
  .math-longdiv {
    display: inline-flex;
  }
  .nthroot-index {
    display: inline-flex;
    min-width: 0.6em;
    min-height: 0.8em;
    align-items: center;
    justify-content: center;
    position: relative;
    padding-right: 2px;
  }
  .math-subscript-group {
    display: inline-block;
  }
  .subscript {
    display: inline-block;
    vertical-align: -0.3em;
    margin-left: 0.05em;
    min-height: 1em;
    min-width: 0.5em;
  }
  .math-bracket {
    display: inline-flex;
    align-items: stretch;
    vertical-align: middle;
  }
  .bracket-evaluation-limits {
    display: inline-flex;
    flex-direction: column;
    justify-content: space-between;
    align-self: stretch;
    margin-left: -2px; /* Move squarebracket and boxes closer to each other */
    line-height: 1;
    position: relative;
  }
  .evaluation-superscript {
    display: inline-flex;
    align-items: center;
    min-height: 1em;
    min-width: 0.5em;
    position: relative;
    top: -0.15em;
  }
  .evaluation-subscript {
    display: inline-flex;
    align-items: center;
    min-height: 1em;
    min-width: 0.5em;
    position: relative;
    bottom: -0.15em;
  }
  .integral-limits {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
    margin-left: -2px;
    align-self: stretch;
  }
  .integral-superscript, .integral-subscript {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    min-height: 1em;
    min-width: 0.5em;
  }
  .integral-superscript {
    position: relative;
    top: 0.05em;
  }
  .integral-subscript {
    position: relative;
    bottom: -0.15em;
    left: -4px;
  }
  .bracket-symbol {
    display: flex;
    align-items: center;
  }
  .bracket-content {
    display: inline-block;
    vertical-align: middle;
    padding: 0 0.1em;
    text-align: left;
    white-space: pre;
  }
  .math-underbrace {
    display: inline-flex;
    align-items: stretch;
    vertical-align: middle;
  }
  .underbrace-content {
    display: inline-block;
    vertical-align: middle;
    padding: 0 0.15em;
    text-align: center;
    white-space: pre;
    min-width: 1em;
    min-height: 1.2em;
  }
  .underbrace-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0.8em;
    min-height: 1.1em;
  }
</style>
