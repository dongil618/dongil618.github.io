# Gemfile
# frozen_string_literal: true
source "https://rubygems.org"

gem "jekyll-theme-chirpy", "~> 7.2", ">= 7.2.4"
gem "html-proofer", "~> 5.0", group: :test

# (로컬 빌드한다면 jekyll을 명시해두는 것도 권장)
# gem "jekyll", "~> 4.3"

group :jekyll_plugins do
  gem "jekyll-sitemap"
end

platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.2.0", :platforms => [:mingw, :x64_mingw, :mswin]
