# EHA Geoname Lookup API

This API is designed for looking up Geonames based on a free text search.
It aims to provide similar functionality to the api.geonames.org/searchJSON endpoint.
Search result rankings take into account the following features:

 * If the search specifies a containing administrative division like "Riverside, Oregon"
   geonames within the administrative division are promoted.
 * Geonames with a greater population are promoted.
 * P and A feature classes (cities, states and countries) are promoted.

### How to deploy Geoname Lookup API

Install ansible and ansible galaxy.

Install 3rd party ansible roles:

```
ansible-galaxy install -r requirements.yml
```

The following will deploy to geoname-lookup.eha.io

```
ansible-playbook site.yml --vault-password-file ~/.keys/.grits_vault_password --private-key infrastructure.pem
```

To deploy somewhere else, replace the target address in inventory.ini and set the domain_name variable in site.yml.
