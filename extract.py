import json

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

start_idx = html.find('<main')
end_idx = html.find('</main>') + 7

main_content = html[start_idx:end_idx]

# Extract the inner part of main to pencarian.html
inner_start = main_content.find('<div class="flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto">')

if inner_start == -1:
    print("Could not find inner start")
    exit(1)

# Find the end of that div (it's the last closing div before </main>)
inner_end = main_content.rfind('</div>')
if inner_end == -1:
    print("Could not find inner end")
    exit(1)

pencarian_html = main_content[inner_start:inner_end+6]

with open('views/pencarian.html', 'w', encoding='utf-8') as f:
    f.write(pencarian_html)

new_html = html[:start_idx] + '<main id="router-view" class="flex-1 overflow-auto p-6"></main>' + html[end_idx:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print('Extracted pencarian.html and updated index.html')
