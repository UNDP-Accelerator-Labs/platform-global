CREATE TABLE thematic_areas (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	name VARCHAR(99) UNIQUE
);
-- INSERT INTO thematic_areas (name)
-- VALUES ('agriculture'),
-- 	('resource management'),
-- 	('energy'),
-- 	('unemployment'),
-- 	('economic growth'),
-- 	('urbanization'),
-- 	('social justice'),
-- 	('migration'),
-- 	('solid waste management'),
-- 	('single use plastic'),
-- 	('circular economy'),
-- 	('climate change'),
-- 	('civic participation'),
-- 	('responsive governance')
-- ;

CREATE TABLE sdgs (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	key INT,
	name VARCHAR(99),
	description TEXT,
	lang VARCHAR(99) DEFAULT 'en'
);
INSERT INTO sdgs (key, name, description, lang)
VALUES (1, 'No poverty', 'End poverty in all its forms everywhere.', 'en'),
	(2, 'Zero hunger', 'End hunger, achieve food security and improved nutrition and promote sustainable agriculture.', 'en'),
	(3, 'Good health and well-being', 'Ensure healthy lives and promote well-being for all at all ages.', 'en'),
	(4, 'Quality education', 'Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.', 'en'),
	(5, 'Gender equality', 'Achieve gender equality and empower all women and girls.', 'en'),
	(6, 'Clean water and sanitation', 'Ensure availability and sustainable management of water and sanitation for all.', 'en'),
	(7, 'Affordable and clean energy', 'Ensure access to affordable, reliable, sustainable and modern energy for all.', 'en'),
	(8, 'Decent work and economic growth', 'Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all.', 'en'),
	(9, 'Industry, innovation and infrastructure', 'Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation.', 'en'),
	(10, 'Reduced innequalities', 'Reduce inequality within and among countries.', 'en'),
	(11, 'Sustainable cities and communities', 'Make cities and human settlements inclusive, safe, resilient and sustainable.', 'en'),
	(12, 'Responsible consumption and production', 'Ensure sustainable consumption and production patterns.', 'en'),
	(13, 'Climate action', 'Take urgent action to combat climate change and its impacts.', 'en'),
	(14, 'Life below water', 'Conserve and sustainably use the oceans, seas and marine resources for sustainable development.', 'en'),
	(15, 'Life on land', 'Protect, restore and promote sustainable use of terrestrial ecosystems, sustainably manage forests, combat desertification, and halt and reverse land degradation.', 'en'),
	(16, 'Peace, justice and strong institutions', 'Promote peaceful and inclusive societies for sustainable development, provide access to justice for all and build effective, accountable and inclusive institutions at all levels.', 'en'),
	(17, 'Partnerships for the goals', 'Strengthen the means of implementation and revitalize the global partnership for sustainable development.', 'en')
;
INSERT INTO sdgs (key, name, description, lang)
VALUES (1, 'Pas de pauvreté', 'Éliminer la pauvreté sous toutes ses formes et partout dans le monde.', 'fr'),
	(2, 'Faim « zéro »', 'Éliminer la faim, assurer la sécurité alimentaire, améliorer la nutrition et promouvoir une agriculture durable.', 'fr'),
	(3, 'Bonne santé et bien-être', 'Donner aux individus les moyens de vivre une vie saine et promouvoir le bien-être à tous les âges.', 'fr'),
	(4, 'Éducation de qualité', 'Veiller à ce que tous puissent suivre une éducation de qualité dans des conditions d’équité et promouvoir les possibilités d’apprentissage tout au long de la vie.', 'fr'),
	(5, 'Égalité entre les sexes', 'Réaliser l’égalité des sexes et autonomiser toutes les femmes et les filles.', 'fr'),
	(6, 'Eau propre et assainissement', 'Garantir l’accès de tous à l’eau et à l’assainissement et assurer une gestion durable des ressources en eau.', 'fr'),
	(7, 'Énergie propre et d’un coût abordable', 'Garantir l’accès de tous à des services énergétiques fiables, durables et modernes, à un coût abordable.', 'fr'),
	(8, 'Travail décent et croissance économique', 'Promouvoir une croissance économique soutenue, partagée et durable, le plein emploi productif et un travail décent pour tous.', 'fr'),
	(9, 'Industrie, innovation et infrastructure', 'Mettre en place une infrastructure résiliente, promouvoir une industrialisation durable qui profite à tous et encourager l’innovation.', 'fr'),
	(10, 'Inégalités réduites', 'Réduire les inégalités entre les pays et en leur sein.', 'fr'),
	(11, 'Villes et communautés durables', 'Faire en sorte que les villes et les établissements humains soient ouverts à tous, sûrs, résilients et durables.', 'fr'),
	(12, 'Consommation et production responsables', 'Établir des modes de consommation et de production durables.', 'fr'),
	(13, 'Mesures relatives à la lutte contre les changements climatiques', 'Prendre d’urgence des mesures pour lutter contre les changements climatiques et leurs répercussions.', 'fr'),
	(14, 'Vie aquatique', 'Conserver et exploiter de manière durable les océans, les mers et les ressources marines aux fins du développement durable.', 'fr'),
	(15, 'Vie terrestre', 'Préserver et restaurer les écosystèmes terrestres.', 'fr'),
	(16, 'Paix, justice et institutions efficaces', 'Promouvoir l’avènement de sociétés pacifiques et ouvertes aux fins du développement durable.', 'fr'),
	(17, 'Partenariats pour la réalisation des objectifs', 'Renforcer les moyens de mettre en œuvre le Partenariat mondial pour le développement et le revitaliser.', 'fr')
;
INSERT INTO sdgs (key, name, description, lang)
VALUES (1, 'Fin de la pobreza', 'Poner fin a la pobreza en todas sus formas en todo el mundo.', 'es'),
	(2, 'Hambre cero', 'Poner fin al hambre.', 'es'),
	(3, 'Salud y bienestar', 'Garantizar una vida sana y promover el bienestar para todos en todas las edades.', 'es'),
	(4, 'Educación de calidad', 'Garantizar una educación inclusiva, equitativa y de calidad y promover oportunidades de aprendizaje durante toda la vida para todos.', 'es'),
	(5, 'Igualdad de géneros', 'Lograr la igualdad entre los géneros y empoderar a todas las mujeres y las niñas.', 'es'),
	(6, 'Agua limpia y saneamiento', 'Garantizar la disponibilidad de agua y su gestión sostenible y el saneamiento para todos.', 'es'),
	(7, 'Energía asequible y no contaminante', 'Garantizar el acceso a una energía asequible, segura, sostenible y moderna.', 'es'),
	(8, 'Tabajo decente y crecimiento económico', 'Promover el crecimiento económico inclusivo y sostenible, el empleo y el trabajo decente para todos.', 'es'),
	(9, 'Industria, innovación e infraestructuras', 'Construir infraestructuras resilientes, promover la industrialización sostenible y fomentar la innovación.', 'es'),
	(10, 'Reducción de las desigualdades', 'Reducir la desigualdad en y entre los países.', 'es'),
	(11, 'Ciudades y comunidades sostenibles', 'Lograr que las ciudades sean más inclusivas, seguras, resilientes y sostenibles.', 'es'),
	(12, 'Producción y consumo responsables', 'Garantizar modalidades de consumo y producción sostenibles.', 'es'),
	(13, 'Acción por el clima', 'Adoptar medidas urgentes para combatir el cambio climático y sus efectos.', 'es'),
	(14, 'Vida submarina', 'Conservar y utilizar sosteniblemente los océanos, los mares y los recursos marinos.', 'es'),
	(15, 'Vida de ecosistemas terrestres', 'Gestionar sosteniblemente los bosques, luchar contra la desertificación, detener e invertir la degradación de las tierras, detener la pérdida de biodiversidad.', 'es'),
	(16, 'Paz, justicia e instituciones sólidas', 'Promover sociedades justas, pacíficas e inclusivas.', 'es'),
	(17, 'Alianzas para lograr los objetivos', 'Revitalizar la Alianza Mundial para el Desarrollo Sostenible.', 'es')
;
INSERT INTO sdgs (key, name, description, lang)
VALUES (1, 'Erradicar a pobreza', 'Erradicar a pobreza em todasassuas formas, em todos os lugares.', 'pt'),
	(2, 'Erradicar a fome', 'Erradicar a fome, alcançar asegurançaalimentar, melhorar a nutrição e promover aagricultura sustentável.', 'pt'),
	(3, 'Saúde de qualidade.', 'Garantir o acesso à saúde de qualidade e promover o bem-estar para todos, em todasas idades.', 'pt'),
	(4, 'Educação de qualidade', 'Garantir o acesso à educação inclusiva, de qualidade e equitativa, e promover oportunidadesde aprendizagem ao longo da vida para todos.', 'pt'),
	(5, 'Igualdade de género', 'Alcançar a igualdade de género e empoderar todas as mulheres e rapariga.', 'pt'),
	(6, 'Água potável e saneamento', 'Garantir adisponibilidade e a gestão sustentável da água potável e do saneamento para todos.', 'pt'),
	(7, 'Energias renováveis e acessíveis', 'Garantir o acesso a fontes de energia fiáveis, sustentáveis e modernas para todos.', 'pt'),
	(8, 'Trabalho digno e crescimento económico', 'Promover o crescimento económico inclusivo e sustentável, o emprego pleno e produtivo e o trabalho digno para todos.', 'pt'),
	(9, 'Indústria, inovação e infraestruturas', 'Construir infraestruturas resilientes, promover a industrialização inclusiva e sustentável e fomentar a inovação.', 'pt'),
	(10, 'Reduzir as desigualdades', 'Reduzir asdesigualdades no interior dos países e entre países.', 'pt'),
	(11, 'Cidades e comunidades sustentáveis', 'Tornar as cidades e comunidades inclusivas, seguras, resilientes e sustentáveis.', 'pt'),
	(12, 'Produção e consumo sustentáveis', 'Garantir padrõesde consumo e de produção sustentáveis.', 'pt'),
	(13, 'Ação climática', 'Adotar medidas urgentes para combater asalterações climáticas e osseus impactos.', 'pt'),
	(14, 'Proteger a vida marinha', 'Conservar e usar de forma sustentável os oceanos, mares e os recursos marinhos para o desenvolvimento sustentável.', 'pt'),
	(15, 'Proteger a vida terrestre', 'Proteger, restaurar e promover o uso sustentável dos ecossistemas terrestres, gerir de formasustentável as florestas, combater adesertificação, travar e reverter adegradação dossolos e travar a perda de biodiversidade.', 'pt'),
	(16, 'Paz, justiça e instituições eficazes', 'Promover sociedades pacíficas e inclusivas para o desenvolvimento sustentável, proporcionar o acesso à justiça para todos e construir instituições eficazes, responsáveis e inclusivasa todos os níveis.', 'pt'),
	(17, 'Parcerias para a implementação dos objetivos', 'Reforçar os meios de implementação e revitalizar aparceria global para o desenvolvimento sustentável', 'pt')
;