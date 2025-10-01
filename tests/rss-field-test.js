import Parser from 'rss-parser'

const parser = new Parser({
	timeout: 30000,
	maxRedirects: 5,
	headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
	}
})

// 创建一个模拟的 Atom feed XML
const mockAtomXML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xml:lang="en-US" xmlns="http://www.w3.org/2005/Atom" xmlns:foaf="http://xmlns.com/foaf/0.1/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">
  <id>tag:theconversation.com,2011:/us/environment/articles</id>
  <link rel="alternate" type="text/html" href="https://theconversation.com"/>
  <link rel="self" type="application/atom+xml" href="https://theconversation.com/us/environment/articles.atom"/>
  <title>Environment + Energy – The Conversation</title>
  <updated>2025-09-26T12:30:52Z</updated>
  <entry>
    <id>tag:theconversation.com,2011:article/263253</id>
    <published>2025-09-26T12:30:52Z</published>
    <updated>2025-09-26T12:30:52Z</updated>
    <link rel="alternate" type="text/html" href="https://theconversation.com/how-sea-star-wasting-disease-transformed-the-west-coasts-ecology-and-economy-263253"/>
    <title>How sea star wasting disease transformed the West Coast’s ecology and economy</title>
    <content type="html">&lt;figure&gt;&lt;img src="https://images.theconversation.com/files/691226/original/file-20250916-56-k9jhld.jpg?ixlib=rb-4.1.0&amp;amp;rect=0%2C300%2C5759%2C3239&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=496&amp;amp;fit=clip" /&gt;&lt;figcaption&gt;&lt;span class="caption"&gt;A sunflower sea star may be about to snack on some sea urchins in California.&lt;/span&gt; &lt;span class="attribution"&gt;&lt;a class="source" href="https://www.gettyimages.com/detail/photo/sunflower-star-royalty-free-image/1185055887"&gt;Brent Durand/Moment via Getty Images&lt;/a&gt;&lt;/span&gt;&lt;/figcaption&gt;&lt;/figure&gt;&lt;p&gt;Before 2013, divers on North America’s west coast rarely saw purple sea urchins. The spiky animals, which are voracious kelp eaters,- were a favorite food of the coast’s iconic &lt;a href="https://www.fisheries.noaa.gov/species/sunflower-sea-star"&gt;sunflower sea stars&lt;/a&gt;. The giant sea stars, recognizable for their many arms, kept the urchin population in check, with the help of sea otters, lobsters and some large fishes.&lt;/p&gt;

&lt;p&gt;That balance allowed the local kelp forests to flourish, providing food and protection for young fish and other sea life.&lt;/p&gt;

&lt;p&gt;Then, in 2013, &lt;a href="https://creoi.org/tracking-sea-star-wasting-disease-using-trained-recreational-divers/"&gt;recreational divers&lt;/a&gt; began noticing gruesomely dissolving sea star corpses and living sea stars that were writhing and twisting, their arms dropping and literally walking away. It was the beginning of a &lt;a href="https://doi.org/10.1126/sciadv.aau7042"&gt;sea star wasting disease outbreak&lt;/a&gt; that would nearly wipe out all the sunflower sea stars along the coast.&lt;/p&gt;

&lt;p&gt;Their disappearance, combined with a massive &lt;a href="https://doi.org/10.1038/s42003-021-01827-6"&gt;marine heat wave&lt;/a&gt; called “the blob,” set off a cascade of catastrophic ecological changes that turned these kelp biodiverse hot spots into vast sea &lt;a href="https://www.latimes.com/california/story/2019-10-24/purple-sea-urchins-california-oregon-coasts"&gt;urchin barrens&lt;/a&gt;, devoid of almost any other species.&lt;/p&gt;

&lt;figure class="align-center zoomable"&gt;
            &lt;a href="https://images.theconversation.com/files/690744/original/file-20250914-56-qp34oe.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=1000&amp;amp;fit=clip"&gt;&lt;img alt="A sea floor landscape of sea urchins and not much else." src="https://images.theconversation.com/files/690744/original/file-20250914-56-qp34oe.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=754&amp;amp;fit=clip" srcset="https://images.theconversation.com/files/690744/original/file-20250914-56-qp34oe.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=400&amp;amp;fit=crop&amp;amp;dpr=1 600w, https://images.theconversation.com/files/690744/original/file-20250914-56-qp34oe.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=400&amp;amp;fit=crop&amp;amp;dpr=2 1200w, https://images.theconversation.com/files/690744/original/file-20250914-56-qp34oe.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=400&amp;amp;fit=crop&amp;amp;dpr=3 1800w, https://images.theconversation.com/files/690744/original/file-20250914-56-qp34oe.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=503&amp;amp;fit=crop&amp;amp;dpr=1 754w, https://images.theconversation.com/files/690744/original/file-20250914-56-qp34oe.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=503&amp;amp;fit=crop&amp;amp;dpr=2 1508w, https://images.theconversation.com/files/690744/original/file-20250914-56-qp34oe.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=503&amp;amp;fit=crop&amp;amp;dpr=3 2262w" sizes="(min-width: 1466px) 754px, (max-width: 599px) 100vw, (min-width: 600px) 600px, 237px"&gt;&lt;/a&gt;
            &lt;figcaption&gt;
              &lt;span class="caption"&gt;Urchin barrens are the result of losing a main sea urchin predator off California.&lt;/span&gt;
              &lt;span class="attribution"&gt;&lt;span class="source"&gt;Brandon Doheny&lt;/span&gt;&lt;/span&gt;
            &lt;/figcaption&gt;
          &lt;/figure&gt;

&lt;p&gt;&lt;div inline-promo-placement="editor"&gt;&lt;/div&gt;&lt;/p&gt;

&lt;p&gt;This disaster also encouraged human innovation, however. The result has brought an unexpected boost for the local fisheries and restaurants through the development of a new culinary delight, and questions about how best to help kelp forests, and the &lt;a href="https://www.nature.com/articles/s41467-023-37385-0"&gt;US$500 billion&lt;/a&gt; in economic value they provide, recover for the future.&lt;/p&gt;

&lt;h2&gt;Losing sea stars disrupted an entire ecosystem&lt;/h2&gt;

&lt;p&gt;I am the director of the &lt;a href="https://www.eemb.ucsb.edu/people/faculty/vega-thurber"&gt;Marine Science Institute in Santa Barbara, California&lt;/a&gt;, one of the areas severely hit by the loss of sea stars. &lt;/p&gt;

&lt;p&gt;From sea star wasting disease, more than &lt;a href="https://www.fisheries.noaa.gov/feature-story/noaa-fisheries-proposes-listing-sunflower-sea-star-threatened-under-endangered-species"&gt;90% of the sunflower sea stars&lt;/a&gt; died along the entirety of North America’s west coast, from Baja to Alaska. In only the first five years of the outbreak, sea star wasting disease become &lt;a href="https://doi.org/10.1073/pnas.1416625111"&gt;one of the largest epidemics&lt;/a&gt; to hit a marine species. By 2017, sunflower sea stars, &lt;em&gt;Pycnopodia helianthoide&lt;/em&gt;, were rarely found south of Washington state.&lt;/p&gt;

&lt;p&gt;For over a decade, the cause of the devastation was a mystery, until recently, when my colleagues traced sea star wasting disease to a &lt;a href="https://theconversation.com/the-bacteria-killing-sea-stars-in-the-pacific-how-our-team-uncovered-a-decade-long-mystery-259875"&gt;highly infectious vibrio bacteria&lt;/a&gt;. Today, sea star wasting disease has spread widely, even &lt;a href="https://doi.org/10.1371/journal.pone.0282550"&gt;as far as Antarctica&lt;/a&gt;.&lt;/p&gt;

&lt;figure&gt;
            &lt;iframe width="440" height="260" src="https://www.youtube.com/embed/sNWaEyWQ3Hk?wmode=transparent&amp;amp;start=0" frameborder="0" allowfullscreen=""&gt;&lt;/iframe&gt;
            &lt;figcaption&gt;&lt;span class="caption"&gt;Discovering the cause of sea star wasting disease. Hakai Institute.&lt;/span&gt;&lt;/figcaption&gt;
          &lt;/figure&gt;

&lt;p&gt;As sea stars disappeared, the purple sea urchin population exploded, increasing an astonishing 10,000% from 2014 to 2022.&lt;/p&gt;

&lt;p&gt;The urchins ate through kelp forests. The resulting loss of kelp canopy and the understory foliage below it reverberated across the whole ecosystem, affecting the tiniest of zooplankton and giants like &lt;a href="https://doi.org/10.1038/s41598-024-59964-x"&gt;gray whales&lt;/a&gt;, all of which are linked in the complex kelp forest food web of who eats who. &lt;/p&gt;

&lt;figure class="align-right zoomable"&gt;
            &lt;a href="https://images.theconversation.com/files/690745/original/file-20250914-56-e58hyl.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=1000&amp;amp;fit=clip"&gt;&lt;img alt="Large stalks of kelp sea grass rising from the sea floor with fish swimming nearby." src="https://images.theconversation.com/files/690745/original/file-20250914-56-e58hyl.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=237&amp;amp;fit=clip" srcset="https://images.theconversation.com/files/690745/original/file-20250914-56-e58hyl.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=799&amp;amp;fit=crop&amp;amp;dpr=1 600w, https://images.theconversation.com/files/690745/original/file-20250914-56-e58hyl.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=799&amp;amp;fit=crop&amp;amp;dpr=2 1200w, https://images.theconversation.com/files/690745/original/file-20250914-56-e58hyl.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=799&amp;amp;fit=crop&amp;amp;dpr=3 1800w, https://images.theconversation.com/files/690745/original/file-20250914-56-e58hyl.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=1004&amp;amp;fit=crop&amp;amp;dpr=1 754w, https://images.theconversation.com/files/690745/original/file-20250914-56-e58hyl.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=1004&amp;amp;fit=crop&amp;amp;dpr=2 1508w, https://images.theconversation.com/files/690745/original/file-20250914-56-e58hyl.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=1004&amp;amp;fit=crop&amp;amp;dpr=3 2262w" sizes="(min-width: 1466px) 754px, (max-width: 599px) 100vw, (min-width: 600px) 600px, 237px"&gt;&lt;/a&gt;
            &lt;figcaption&gt;
              &lt;span class="caption"&gt;Kelp forests provide food for many species and safety for young fish.&lt;/span&gt;
              &lt;span class="attribution"&gt;&lt;span class="source"&gt;Katie Davis&lt;/span&gt;&lt;/span&gt;
            &lt;/figcaption&gt;
          &lt;/figure&gt;

&lt;p&gt;Ecological cascades – a succession of changes across an ecosystem when habitats are disturbed – can occur when critical populations disappear or change in other significant ways. &lt;/p&gt;

&lt;p&gt;Removing the kelp alters light levels below, leading to changes such as turf algae growth in place of filter-feeding invertebrates such as clams and scallops. Turf algae also make it harder for kelp to regrow, exacerbating the problem.&lt;/p&gt;

&lt;p&gt;The loss of kelp also resulted in fewer mysids, a zooplankton that relies on kelp for habitat and which makes up a majority of gray whales’ diets. Thus, as urchin populations went up and kelp disappeared, gray whales also had less food.&lt;/p&gt;

&lt;h2&gt;How California learned to embrace the urchin&lt;/h2&gt;

&lt;p&gt;The loss of sunflower sea stars to wasting disease has not only altered the kelp ecosystem, but it has also altered the landscape of Pacific fisheries, potentially forever.&lt;/p&gt;

&lt;p&gt;When I started research on purple sea urchins in 2001, there were &lt;a href="https://www.nytimes.com/2021/10/04/dining/california-sea-urchin-kelp-coastline.html"&gt;not enough specimens&lt;/a&gt; in the whole of the Monterey Bay for me to collect and use for my studies. In fact, I had to order my animals from an East Coast distributor.&lt;/p&gt;

&lt;p&gt;Mostly there were red sea urchins, &lt;em&gt;Strongylocentrotus fransiscanus&lt;/em&gt;, highly prized for their large and delicious gonads and sold as “uni” to American and Asian markets.&lt;/p&gt;

&lt;p&gt;But with the recent purple sea urchin boom, &lt;em&gt;Strongylocentrotus purpuratus&lt;/em&gt;, a new and unexpected market on the west coast has blossomed – taking these kelp killers out of the sea and &lt;a href="https://www.npr.org/transcripts/1087712567"&gt;onto plates in restaurants&lt;/a&gt; around America.&lt;/p&gt;

&lt;figure class="align-center zoomable"&gt;
            &lt;a href="https://images.theconversation.com/files/690752/original/file-20250914-56-acfywt.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=1000&amp;amp;fit=clip"&gt;&lt;img alt="An urchin split open on a dinner plate with uni inside" src="https://images.theconversation.com/files/690752/original/file-20250914-56-acfywt.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=754&amp;amp;fit=clip" srcset="https://images.theconversation.com/files/690752/original/file-20250914-56-acfywt.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=389&amp;amp;fit=crop&amp;amp;dpr=1 600w, https://images.theconversation.com/files/690752/original/file-20250914-56-acfywt.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=389&amp;amp;fit=crop&amp;amp;dpr=2 1200w, https://images.theconversation.com/files/690752/original/file-20250914-56-acfywt.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=389&amp;amp;fit=crop&amp;amp;dpr=3 1800w, https://images.theconversation.com/files/690752/original/file-20250914-56-acfywt.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=489&amp;amp;fit=crop&amp;amp;dpr=1 754w, https://images.theconversation.com/files/690752/original/file-20250914-56-acfywt.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=489&amp;amp;fit=crop&amp;amp;dpr=2 1508w, https://images.theconversation.com/files/690752/original/file-20250914-56-acfywt.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=489&amp;amp;fit=crop&amp;amp;dpr=3 2262w" sizes="(min-width: 1466px) 754px, (max-width: 599px) 100vw, (min-width: 600px) 600px, 237px"&gt;&lt;/a&gt;
            &lt;figcaption&gt;
              &lt;span class="caption"&gt;Sea urchin on the menu in Japan. The orange-yellow uni are the creature’s gonads.&lt;/span&gt;
              &lt;span class="attribution"&gt;&lt;a class="source" href="https://www.flickr.com/photos/smwhang/3784482468"&gt;Sung Ming Whang/Flickr&lt;/a&gt;, &lt;a class="license" href="http://creativecommons.org/licenses/by/4.0/"&gt;CC BY&lt;/a&gt;&lt;/span&gt;
            &lt;/figcaption&gt;
          &lt;/figure&gt;

&lt;p&gt;This pivot from reds to purple urchins by fishers and the aquaculture industry took time and creativity. Purple sea urchins tend to be small and lack the rich gonads that make the reds so profitable. To adjust their &lt;a href="https://doi.org/10.1111/raq.12256"&gt;flavor, texture and size&lt;/a&gt;, innovators turned to harvesting these animals from the sea by hand and then moving them to land-based facilities – called “urchin ranches” – where they fatten up by eating seaweeds.&lt;/p&gt;

&lt;p&gt;The results have been remarkable. In Santa Barbara, a thriving industry now raises these animals for the &lt;a href="https://www.latimes.com/food/story/2022-03-03/from-plague-to-delicacy-reconsidering-purple-sea-urchin"&gt;culinary market&lt;/a&gt;, where the artisanal urchins go for $8 to $10 a pop. In one example, an &lt;a href="https://www.culturedabalone.com/"&gt;abalone aquaculture program&lt;/a&gt; used its expertise and facility to profit from this &lt;a href="https://www.independent.com/2021/02/24/purple-urchin-possibilities/"&gt;new abundance&lt;/a&gt;.&lt;/p&gt;

&lt;h2&gt;Innovative ways to solve kelp decline&lt;/h2&gt;

&lt;p&gt;You might be asking yourself if we can just eat our way out of this crisis.&lt;/p&gt;

&lt;p&gt;It’s not a new idea. The invasion of &lt;a href="https://www.fisheries.noaa.gov/southeast/ecosystems/impacts-invasive-lionfish"&gt;Pacific lionfish&lt;/a&gt; into Florida coasts, the Gulf of Mexico and parts of the Caribbean was slowed down by local divers and recreational fishing groups teaming up to hunt and then &lt;a href="https://www.theguardian.com/global-development/2023/sep/26/off-the-reef-and-on-the-menu-fishers-in-the-caribbean-wage-war-on-the-invasive-lionfish"&gt;market lionfish to restaurants&lt;/a&gt;.&lt;/p&gt;

&lt;p&gt;It is unlikely that purple sea urchin ranching will make much of a dent in the population, but numerous projects are currently aimed at both recovering kelp forests and keeping the monetary benefits of the urchin boom flowing to the local economy simultaneously. The ingenuity to flip a bad outcome into a productive local aquaculture industry has been so popular that even state agencies are now &lt;a href="https://www.thenewsguard.com/business/new-initiative-boosts-purple-sea-urchin-harvesting-and-processing/article_f72cb4c4-4379-5c72-8934-8a9bd3f8affa.html"&gt;funding local innovators&lt;/a&gt; to expand purple urchin ranching, assisting both the local environment and the local economy.&lt;/p&gt;

&lt;figure class="align-center zoomable"&gt;
            &lt;a href="https://images.theconversation.com/files/690746/original/file-20250914-56-zosmuz.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=1000&amp;amp;fit=clip"&gt;&lt;img alt="Two dozen sea stars on the sea floor and not much else." src="https://images.theconversation.com/files/690746/original/file-20250914-56-zosmuz.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=754&amp;amp;fit=clip" srcset="https://images.theconversation.com/files/690746/original/file-20250914-56-zosmuz.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=337&amp;amp;fit=crop&amp;amp;dpr=1 600w, https://images.theconversation.com/files/690746/original/file-20250914-56-zosmuz.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=337&amp;amp;fit=crop&amp;amp;dpr=2 1200w, https://images.theconversation.com/files/690746/original/file-20250914-56-zosmuz.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=337&amp;amp;fit=crop&amp;amp;dpr=3 1800w, https://images.theconversation.com/files/690746/original/file-20250914-56-zosmuz.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=423&amp;amp;fit=crop&amp;amp;dpr=1 754w, https://images.theconversation.com/files/690746/original/file-20250914-56-zosmuz.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=423&amp;amp;fit=crop&amp;amp;dpr=2 1508w, https://images.theconversation.com/files/690746/original/file-20250914-56-zosmuz.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=423&amp;amp;fit=crop&amp;amp;dpr=3 2262w" sizes="(min-width: 1466px) 754px, (max-width: 599px) 100vw, (min-width: 600px) 600px, 237px"&gt;&lt;/a&gt;
            &lt;figcaption&gt;
              &lt;span class="caption"&gt;Purple sea urchins have taken over stretches of sea floor off California and ate down the kelp, leaving little behind.&lt;/span&gt;
              &lt;span class="attribution"&gt;&lt;a class="source" href="https://commons.wikimedia.org/wiki/File:Purple_Sea_Urchins_%287622488604%29.jpg"&gt;Ed Bierman via Wikimedia Commons&lt;/a&gt;, &lt;a class="license" href="http://creativecommons.org/licenses/by/4.0/"&gt;CC BY&lt;/a&gt;&lt;/span&gt;
            &lt;/figcaption&gt;
          &lt;/figure&gt;

&lt;p&gt;Scientists, state agencies and conservation groups are working on sunflower sea star restoration efforts and &lt;a href="https://www.merkley.senate.gov/merkley-wyden-announce-oregon-projects-promoting-economic-development-and-community-safety-pass-in-2024-funding-package/"&gt;kelp recovery programs&lt;/a&gt;, and are considering other ways to reduce the urchin population.&lt;/p&gt;

&lt;p&gt;One option is to increase &lt;a href="https://www.fws.gov/project/exploring-potential-sea-otter-reintroduction"&gt;otter populations&lt;/a&gt; in places like Northern California and Oregon, where they were once abundant. Otters can eat upward of 10,000 urchins per year. But the approach is controversial in Southern California. A similar &lt;a href="https://pubs.usgs.gov/publication/ofr20231071/full"&gt;conservation effort&lt;/a&gt; failed before, and there are concerns about the effects a bigger otter population would have on local fisheries, including the now-depleted &lt;a href="https://pubs.usgs.gov/publication/70159816"&gt;black abalone&lt;/a&gt;.&lt;/p&gt;

&lt;h2&gt;So where do we go from here?&lt;/h2&gt;

&lt;p&gt;As the world’s appetite for &lt;a href="https://www.nature.com/articles/s41467-024-51965-8"&gt;farmed seafood has expanded&lt;/a&gt;, groups like &lt;a href="https://www.urchinomics.com/"&gt;Urchinomics&lt;/a&gt; and their investors are using this edible calamity to promote kelp restoration, create jobs and boost local economies.&lt;/p&gt;

&lt;p&gt;In a way, sea star wasting disease and the precipitous kelp declines inadvertently created a mutually beneficial alignment of conservation, local artisanal fishing and land-based aquaculture.&lt;/p&gt;

&lt;figure class="align-center zoomable"&gt;
            &lt;a href="https://images.theconversation.com/files/690747/original/file-20250914-64-suh82x.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=1000&amp;amp;fit=clip"&gt;&lt;img alt="A seafloor view with several species." src="https://images.theconversation.com/files/690747/original/file-20250914-64-suh82x.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=754&amp;amp;fit=clip" srcset="https://images.theconversation.com/files/690747/original/file-20250914-64-suh82x.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=337&amp;amp;fit=crop&amp;amp;dpr=1 600w, https://images.theconversation.com/files/690747/original/file-20250914-64-suh82x.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=337&amp;amp;fit=crop&amp;amp;dpr=2 1200w, https://images.theconversation.com/files/690747/original/file-20250914-64-suh82x.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=600&amp;amp;h=337&amp;amp;fit=crop&amp;amp;dpr=3 1800w, https://images.theconversation.com/files/690747/original/file-20250914-64-suh82x.jpg?ixlib=rb-4.1.0&amp;amp;q=45&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=423&amp;amp;fit=crop&amp;amp;dpr=1 754w, https://images.theconversation.com/files/690747/original/file-20250914-64-suh82x.jpg?ixlib=rb-4.1.0&amp;amp;q=30&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=423&amp;amp;fit=crop&amp;amp;dpr=2 1508w, https://images.theconversation.com/files/690747/original/file-20250914-64-suh82x.jpg?ixlib=rb-4.1.0&amp;amp;q=15&amp;amp;auto=format&amp;amp;w=754&amp;amp;h=423&amp;amp;fit=crop&amp;amp;dpr=3 2262w" sizes="(min-width: 1466px) 754px, (max-width: 599px) 100vw, (min-width: 600px) 600px, 237px"&gt;&lt;/a&gt;
            &lt;figcaption&gt;
              &lt;span class="caption"&gt;A sunflower star (blue) with other sea stars (orange) and a sea anemone off the central California coast.&lt;/span&gt;
              &lt;span class="attribution"&gt;&lt;a class="source" href="https://commons.wikimedia.org/wiki/File:Purple_Sea_Urchins_%287622488604%29.jpg"&gt;Ed Bierman via Wikimedia Commons&lt;/a&gt;, &lt;a class="license" href="http://creativecommons.org/licenses/by/4.0/"&gt;CC BY&lt;/a&gt;&lt;/span&gt;
            &lt;/figcaption&gt;
          &lt;/figure&gt;

&lt;p&gt;In the long term, additional marine heat waves, like the &lt;a href="https://www.integratedecosystemassessment.noaa.gov/regions/california-current/california-current-marine-heatwave-tracker-blobtracker"&gt;one occurring in 2025&lt;/a&gt;, and their associated marine diseases and subsequent habitat losses, require global actions to reduce climate change. Future outbreaks like sea star wasting disease are &lt;a href="https://doi.org/10.1016/j.isci.2024.110838"&gt;almost certain to emerge&lt;/a&gt;.&lt;/p&gt;

&lt;p&gt;Yet, it has also been found that some of the harms of urchin population growth can be lessened when sections of ocean are protected. For example, in some California marine protected areas where urchin predator diversity was high, the &lt;a href="https://doi.org/10.1002/ecy.2993"&gt;impacts of sea star wasting disease and its ecological cascade were reduced&lt;/a&gt;. In other words, in areas where there was limited fishing, as sea star numbers dropped, the urchin population was at least partially kept in check by those legally protected predators.&lt;/p&gt;

&lt;p&gt;This finding suggests that along with global carbon reductions, local conservation and human innovations – like those bringing purple uni to our plates – can help prevent some ecological cascades that harm our increasingly threatened marine resources.&lt;/p&gt;&lt;img src="https://counter.theconversation.com/content/263253/count.gif" alt="The Conversation" width="1" height="1" /&gt;
&lt;p class="fine-print"&gt;&lt;em&gt;&lt;span&gt;Rebecca Vega Thurber does not work for, consult, own shares in or receive funding from any company or organization that would benefit from this article, and has disclosed no relevant affiliations beyond their academic appointment.&lt;/span&gt;&lt;/em&gt;&lt;/p&gt;</content>
    <summary>The loss of one iconic species, sunflower sea stars, unleashed a voracious eater of seagrass habitats and upended the coastal ecosystem. But the response has opened new business opportunities.</summary>
    <author>
      <name>Rebecca Vega Thurber, Professor of Ecology Evolution and Marine Biology; Director of the Marine Science Institute, University of California, Santa Barbara</name>
      <foaf:homepage rdf:resource="https://theconversation.com/profiles/rebecca-vega-thurber-2430876"/>
    </author>
    <rights>Licensed as Creative Commons – attribution, no derivatives.</rights>
  </entry>
 
</feed>`

try {
	console.log('🧪 Testing RSS Parser with mock Atom data...\n')

	// 使用 parseString 方法解析 XML 字符串
	const feed = await parser.parseString(mockAtomXML)

	console.log('📰 Feed Information:')
	console.log('Title:', feed.title)
	console.log('Description:', feed.description)
	console.log('Link:', feed.link)
	console.log('Last Updated:', feed.lastBuildDate || feed.updated)
	console.log('Total items:', feed.items.length)
	console.log()

	if (feed.items.length > 0) {
		console.log('📋 Available fields in each item:')
		console.log('Fields:', Object.keys(feed.items[0]))
		console.log()

		console.log('📄 First article details:')
		const firstItem = feed.items[0]

		// console.log('contentSnippet:', firstItem.contentSnippet)
		// console.log('content:', firstItem.content)
		console.log('Title:', firstItem.title)
		// console.log('Link:', firstItem.link)
		// console.log('Published:', firstItem.pubDate)
		// console.log('Author:', firstItem.author)
		// console.log('Summary:', firstItem.summary)
		console.log('id:', firstItem.id)
		console.log('isoDate:', firstItem.isoDate)
		console.log()
	}
} catch (error) {
	console.error('❌ Error parsing feed:', error.message)
	console.error('Stack:', error.stack)
}
