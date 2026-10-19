import sys

with open('src/views/ChatWindow.svelte', 'r') as f:
    content = f.read()

# 1. Draft image container styling
old_draft_img = '''                       <!-- Draft Image Container (No bevels, retains natural shape & ratio) -->
                       <div 
                         data-image-container="draft"
                         class="relative max-w-full inline-block group/draftimg overflow-visible mb-2 transition-all rounded-xl cursor-pointer {selectedDraftImageId === img.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}"
                         onclick={() => { if (!isSketchMode) selectDraftImage(img.id); }}
                       >
                          <div class="rounded-xl overflow-hidden">
                            <img 
                              src={img.url} 
                              alt={img.name || 'staged attachment'} 
                              class="w-auto max-w-full h-auto max-h-[500px] object-contain rounded-xl block"
                            />
                          </div>'''

new_draft_img = '''                       <!-- Draft Image Container (No bevels, retains natural shape & ratio) -->
                       <div 
                         data-image-container="draft"
                         class="relative max-w-full inline-block group/draftimg overflow-visible mb-2 transition-all rounded-xl cursor-pointer bg-transparent border-0 shadow-none {selectedDraftImageId === img.id ? 'ring-2 ring-blue-500' : ''}"
                         style="background: transparent; border: none; box-shadow: none;"
                         onclick={() => { if (!isSketchMode) selectDraftImage(img.id); }}
                       >
                          <div class="rounded-xl overflow-hidden bg-transparent border-0 shadow-none">
                            <img 
                              src={img.url} 
                              alt={img.name || 'staged attachment'} 
                              class="w-auto max-w-full h-auto max-h-[520px] object-contain rounded-xl block border-0 shadow-none"
                              style="aspect-ratio: auto; max-width: 100%; height: auto;"
                            />
                          </div>'''

# 2. Sent multi-image attachments
old_sent_multi = '''                          <div 
                            data-image-container={m.id}
                            class="relative max-w-full inline-block group/img overflow-hidden rounded-xl cursor-pointer transition-transform hover:scale-[1.005]"
                            onclick={() => { if (!isSketchMode) zoomedImageId = m.id; }}
                          >
                             <img 
                               src={att.url} 
                               alt={att.name || 'attached'} 
                               class="w-auto max-w-full h-auto max-h-[500px] object-contain rounded-xl block transition-opacity duration-500 {loadedImages[`${m.id}_${imgIdx}`] || loadedImages[m.id] ? 'opacity-100' : 'opacity-0'}" 
                               onload={() => { loadedImages[`${m.id}_${imgIdx}`] = true; loadedImages[m.id] = true; }}
                             />'''

new_sent_multi = '''                          <div 
                            data-image-container={m.id}
                            class="relative max-w-full inline-block group/img overflow-hidden rounded-xl cursor-pointer transition-transform hover:scale-[1.005] bg-transparent border-0 shadow-none"
                            style="background: transparent; border: none; box-shadow: none;"
                            onclick={() => { if (!isSketchMode) zoomedImageId = m.id; }}
                          >
                             <img 
                               src={att.url} 
                               alt={att.name || 'attached'} 
                               class="w-auto max-w-full h-auto max-h-[520px] object-contain rounded-xl block border-0 shadow-none transition-opacity duration-500 {loadedImages[`${m.id}_${imgIdx}`] || loadedImages[m.id] ? 'opacity-100' : 'opacity-0'}" 
                               style="aspect-ratio: auto; max-width: 100%; height: auto;"
                               onload={() => { loadedImages[`${m.id}_${imgIdx}`] = true; loadedImages[m.id] = true; }}
                             />'''

# 3. Sent single-image attachment
old_sent_single = '''                    <div 
                      data-image-container={m.id}
                      class="relative max-w-full inline-block group/img overflow-hidden rounded-xl cursor-pointer transition-transform hover:scale-[1.005]"
                      onclick={() => { if (!isSketchMode) zoomedImageId = m.id; }}
                    >
                       <img 
                         src={primaryAttachment.url} 
                         alt="attached" 
                         class="w-auto max-w-full h-auto max-h-[500px] object-contain rounded-xl block transition-opacity duration-500 {loadedImages[m.id] ? 'opacity-100' : 'opacity-0'}" 
                         onload={() => loadedImages[m.id] = true}
                       />'''

new_sent_single = '''                    <div 
                      data-image-container={m.id}
                      class="relative max-w-full inline-block group/img overflow-hidden rounded-xl cursor-pointer transition-transform hover:scale-[1.005] bg-transparent border-0 shadow-none"
                      style="background: transparent; border: none; box-shadow: none;"
                      onclick={() => { if (!isSketchMode) zoomedImageId = m.id; }}
                    >
                       <img 
                         src={primaryAttachment.url} 
                         alt="attached" 
                         class="w-auto max-w-full h-auto max-h-[520px] object-contain rounded-xl block border-0 shadow-none transition-opacity duration-500 {loadedImages[m.id] ? 'opacity-100' : 'opacity-0'}" 
                         style="aspect-ratio: auto; max-width: 100%; height: auto;"
                         onload={() => loadedImages[m.id] = true}
                       />'''

print('Found draft img:', old_draft_img in content)
print('Found sent multi:', old_sent_multi in content)
print('Found sent single:', old_sent_single in content)

if old_draft_img in content and old_sent_multi in content and old_sent_single in content:
    content = content.replace(old_draft_img, new_draft_img)
    content = content.replace(old_sent_multi, new_sent_multi)
    content = content.replace(old_sent_single, new_sent_single)
    with open('src/views/ChatWindow.svelte', 'w') as f:
        f.write(content)
    print('SUCCESSFULLY REPLACED!')
else:
    print('Failed to match')
    sys.exit(1)
