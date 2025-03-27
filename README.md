Technologies Used:

Front End - Bootstrap, HTML5, CSS3, JavaScript, AJAX 
Backend – PHP, MySQL

run mysql serve, and execute floowing commands:

CREATE USER 'ridewithus'@'localhost' IDENTIFIED BY 'rideLikeABoss';
GRANT CREATE ON *.* TO 'ridewithus'@'localhost';
FLUSH PRIVILEGES;
CREATE DATABASE IF NOT EXISTS ridewithus;

run functions/setup.php to create tables
run php server
