// Where the pictures in My Care come from (shown under Profile → Photo credits).
// All are free to use: public domain, CC0, CC BY or CC BY-SA. CC BY / BY-SA
// need this credit. Fruit photos were cropped to one item and their
// background removed; baby drawings were trimmed and lightly tinted.

export type PhotoCredit = {
  key: string;
  name: string;
  title: string;
  by: string;
  license: string;
  licenseUrl: string;
  source: string;
};

export const CARE_PHOTO_CREDITS: readonly PhotoCredit[] = [
  { key: 'baby-cells', name: 'Baby: week 4 (cells)', title: 'Human Blastocyst (NIH BioArt 209 - 630563)', by: 'NIAID (Ryan Kissinger)', license: 'Public domain', licenseUrl: '', source: 'https://commons.wikimedia.org/wiki/File:Human_Blastocyst_(NIH_BioArt_209_-_630563).svg' },
  { key: 'baby-embryo', name: 'Baby: weeks 5–8', title: 'Human embryo - 6 weeks', by: 'Unknown author, via Wikimedia Commons', license: 'CC BY-SA 2.5', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5', source: 'https://commons.wikimedia.org/wiki/File:Human_embryo_-_6_weeks.jpg' },
  { key: 'baby-fetus', name: 'Baby: weeks 9–27', title: 'Reproductive system - Fetus 1 -- Smart-Servier', by: 'Servier Medical Art', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', source: 'https://commons.wikimedia.org/wiki/File:Reproductive_system_-_Fetus_1_--_Smart-Servier.png' },
  { key: 'baby-grown', name: 'Baby: weeks 28–40', title: 'Reproductive system - Fetus 2 -- Smart-Servier', by: 'Servier Medical Art', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', source: 'https://commons.wikimedia.org/wiki/File:Reproductive_system_-_Fetus_2_--_Smart-Servier.png' },
  { key: 'amla', name: 'Amla', title: 'Phyllanthus emblica - whole and cross section', by: 'Salil Kumar Mukherjee', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Phyllanthus_emblica_-_whole_and_cross_section.jpg' },
  { key: 'apple', name: 'Apple', title: '190918 Fräulein Apfel', by: 'ElbeObst', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:190918_Fr%C3%A4ulein_Apfel.png' },
  { key: 'ashgourd', name: 'Ash gourd', title: 'A winter melon', by: 'GTSPACE', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', source: 'https://commons.wikimedia.org/wiki/File:A_winter_melon.jpg' },
  { key: 'banana', name: 'Banana', title: 'Banana (14237127470)', by: 'Tim Reckmann from Hamm, Deutschland', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0', source: 'https://commons.wikimedia.org/wiki/File:Banana_(14237127470).jpg' },
  { key: 'bottlegourd', name: 'Bottle gourd', title: 'Lagenaria siceraria baby fruit', by: 'TBhagat', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Lagenaria_siceraria_baby_fruit.jpeg' },
  { key: 'brinjal', name: 'Brinjal', title: 'Aubergine', by: 'Horst Frank', license: 'CC BY-SA 3.0', licenseUrl: 'http://creativecommons.org/licenses/by-sa/3.0/', source: 'https://commons.wikimedia.org/wiki/File:Aubergine.jpg' },
  { key: 'cabbage', name: 'Cabbage', title: 'Cabbage', by: 'Alabama Extension', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', source: 'https://www.flickr.com/photos/184594136@N08/51299736854' },
  { key: 'capsicum', name: 'Capsicum', title: 'Green Bell Pepper (53630132710)', by: 'Alabama Extension', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', source: 'https://commons.wikimedia.org/wiki/File:Green_Bell_Pepper_(53630132710).jpg' },
  { key: 'carrot', name: 'Carrot', title: 'Vegetable-Carrot-Bundle-wStalks', by: 'Evan-Amos', license: 'Public domain', licenseUrl: '', source: 'https://commons.wikimedia.org/wiki/File:Vegetable-Carrot-Bundle-wStalks.jpg' },
  { key: 'cauliflower', name: 'Cauliflower', title: 'Cauliflower 2', by: 'Tiia Monto', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Cauliflower_2.jpg' },
  { key: 'coconut', name: 'Coconut', title: 'Coconut face', by: 'Petey21', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', source: 'https://commons.wikimedia.org/wiki/File:Coconut_face.jpg' },
  { key: 'corn', name: 'Corn cob', title: 'Zea mays \'vacquiers\' MHNT.BOT.2015.34.37', by: 'Roger Culos', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', source: 'https://commons.wikimedia.org/wiki/File:Zea_mays_%27vacquiers%27_MHNT.BOT.2015.34.37.jpg' },
  { key: 'cucumber', name: 'Cucumber', title: 'Cucumber from Denmark', by: 'WiseMan42', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', source: 'https://commons.wikimedia.org/wiki/File:Cucumber_from_Denmark.jpg' },
  { key: 'fig', name: 'Fig', title: 'Fig (Ficus carica) fruit halved', by: 'Ivar Leidus', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Fig_(Ficus_carica)_fruit_halved.jpg' },
  { key: 'grape', name: 'Grape', title: 'Campbell Early grape', by: 'Ulysses Prentiss Hedrick', license: 'Public domain', licenseUrl: '', source: 'https://commons.wikimedia.org/wiki/File:Campbell_Early_grape.jpg' },
  { key: 'guava', name: 'Guava', title: 'Psidium guajava (fruit)', by: 'Hans Hillewaert', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', source: 'https://commons.wikimedia.org/wiki/File:Psidium_guajava_(fruit).jpg' },
  { key: 'jackfruit', name: 'Jackfruit', title: 'Artocarpus heterophyllus (Jackfruit) (28260465513)', by: 'Treeworld Wholesale', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0', source: 'https://commons.wikimedia.org/wiki/File:Artocarpus_heterophyllus_(Jackfruit)_(28260465513).jpg' },
  { key: 'jamun', name: 'Jamun', title: 'Java plum (Syzygium cumini)', by: 'Salil Kumar Mukherjee', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Java_plum_(Syzygium_cumini).jpg' },
  { key: 'lemon', name: 'Lemon', title: 'Lemon-Whole-Split', by: 'Evan-Amos', license: 'Public domain', licenseUrl: '', source: 'https://commons.wikimedia.org/wiki/File:Lemon-Whole-Split.jpg' },
  { key: 'mango', name: 'Mango', title: 'Mangofil on white background', by: 'Filo gèn\'', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Mangofil_on_white_background.jpg' },
  { key: 'muskmelon', name: 'Muskmelon', title: 'Cantaloupe', by: 'Renee Comet', license: 'Public domain', licenseUrl: '', source: 'https://commons.wikimedia.org/wiki/File:Cantaloupe.jpg' },
  { key: 'papaya', name: 'Papaya', title: 'Carica papaya Fruit', by: 'Dinkun Chen', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Carica_papaya_Fruit.jpg' },
  { key: 'peanut', name: 'Peanut', title: 'Cacahuete - Petr Kratochvil', by: 'Petr Kratochvil', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', source: 'https://commons.wikimedia.org/wiki/File:Cacahuete_-_Petr_Kratochvil.jpg' },
  { key: 'pineapple', name: 'Pineapple', title: 'Ananas~May 2008-1', by: 'Alvesgaspar', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', source: 'https://commons.wikimedia.org/wiki/File:Ananas~May_2008-1.jpg' },
  { key: 'pomegranate', name: 'Pomegranate', title: 'Punica granatum 3', by: 'Mogor', license: 'CC BY-SA 3.0', licenseUrl: 'http://creativecommons.org/licenses/by-sa/3.0/', source: 'https://commons.wikimedia.org/wiki/File:Punica_granatum_3.jpg' },
  { key: 'poppy', name: 'Poppy seeds', title: 'Poppy seeds 0', by: 'Thomas Bresson', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0', source: 'https://commons.wikimedia.org/wiki/File:Poppy_seeds_0.jpg' },
  { key: 'pumpkin', name: 'Pumpkin', title: 'Vegetable pumpkin', by: 'Luke', license: 'Public domain', licenseUrl: '', source: 'https://commons.wikimedia.org/wiki/File:Vegetable_pumpkin.jpg' },
  { key: 'radish', name: 'Radish', title: 'Raphanus sativus subsp acanthiformis (Daikon) Zelenyi bogatyr20131024 04', by: 'Bff', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Raphanus_sativus_subsp_acanthiformis_(Daikon)_Zelenyi_bogatyr20131024_04.jpg' },
  { key: 'rice', name: 'Rice', title: 'Short-grain rice (japonica)', by: 'ch1310', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', source: 'https://commons.wikimedia.org/wiki/File:Short-grain_rice_(japonica).jpg' },
  { key: 'ridgegourd', name: 'Ridge gourd', title: 'Ridged gourd, angled luffa, Chinese okra', by: 'SarKaLay', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Ridged_gourd,_angled_luffa,_Chinese_okra.jpg' },
  { key: 'sapota', name: 'Sapota', title: 'Manilkara zapota - Nispero fruit (sapodilla) and leaves 03', by: 'Daniel Di Palma', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Manilkara_zapota_-_Nispero_fruit_(sapodilla)_and_leaves_03.jpg' },
  { key: 'sesame', name: 'Sesame seeds', title: 'Sa white sesame seeds', by: 'Sanjay ach', license: 'CC BY-SA 3.0', licenseUrl: 'http://creativecommons.org/licenses/by-sa/3.0/', source: 'https://commons.wikimedia.org/wiki/File:Sa_white_sesame_seeds.jpg' },
  { key: 'sweetpotato', name: 'Sweet potato', title: 'Ipomoea batatus-tuber-yercaud-salem-India', by: 'Yercaud-elango', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Ipomoea_batatus-tuber-yercaud-salem-India.JPG' },
  { key: 'watermelon', name: 'Watermelon', title: 'Watermelon (Ekanuwa)', by: 'Lituleni', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Watermelon_(Ekanuwa).jpg' },
];
